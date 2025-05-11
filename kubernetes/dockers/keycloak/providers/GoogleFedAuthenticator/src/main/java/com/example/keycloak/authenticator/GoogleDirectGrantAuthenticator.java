package com.example.keycloak.authenticator;

import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.authentication.Authenticator;
import org.keycloak.broker.oidc.OIDCIdentityProvider;
import org.keycloak.broker.oidc.OIDCIdentityProviderConfig;
import org.keycloak.broker.provider.BrokeredIdentityContext;
import org.keycloak.broker.provider.IdentityProviderMapper;
import org.keycloak.models.*;
import org.keycloak.models.utils.KeycloakModelUtils;
import org.keycloak.provider.ProviderFactory;
import org.keycloak.utils.StringUtil;

public class GoogleDirectGrantAuthenticator implements Authenticator {

    private static final Logger logger = Logger.getLogger(GoogleDirectGrantAuthenticator.class);
    private static final String GOOGLE_ALIAS = "google";

    @Override
    public void authenticate(AuthenticationFlowContext context) {
        MultivaluedMap<String, String> form = context.getHttpRequest().getDecodedFormParameters();
        String federatedTokenJson = form.getFirst("google_token");

        if (StringUtil.isBlank(federatedTokenJson)) {
            logger.warn("🛑 Token Google mancante");
            context.failure(AuthenticationFlowError.INVALID_CREDENTIALS);
            return;
        }

        KeycloakSession session = context.getSession();
        RealmModel realm = context.getRealm();

        IdentityProviderModel idpModel = realm.getIdentityProviderByAlias(GOOGLE_ALIAS);
        if (idpModel == null) {
            logger.error("❌ IdentityProvider 'google' non configurato");
            context.failure(AuthenticationFlowError.IDENTITY_PROVIDER_NOT_FOUND);
            return;
        }

        try {
            OIDCIdentityProviderConfig config = new OIDCIdentityProviderConfig(idpModel);
            OIDCIdentityProvider provider = new OIDCIdentityProvider(session, config);
            BrokeredIdentityContext identity = provider.getFederatedIdentity(federatedTokenJson);

            if (identity == null) {
                logger.error("❌ FederatedIdentityContext nullo");
                context.failure(AuthenticationFlowError.IDENTITY_PROVIDER_ERROR);
                return;
            }

            identity.setIdp(provider);
            String email = identity.getEmail();
            String username = email != null ? email : identity.getUsername();

        
            FederatedIdentityModel model = new FederatedIdentityModel(
                GOOGLE_ALIAS,
                identity.getId(),
                username,
                federatedTokenJson
            );

            UserModel user = session.users().getUserByFederatedIdentity(realm, model);
            boolean isNew = false;

            if (user == null && identity.getEmail() != null) {
                UserModel emailUser = session.users().getUserByEmail(realm, identity.getEmail());
            
                if (emailUser != null) {
                    try {
                        FederatedIdentityModel existing = session.users().getFederatedIdentity(realm, emailUser, GOOGLE_ALIAS);
                        if (existing != null) {
                            logger.infof("✅ Utente già federato con Google: %s", emailUser.getUsername());
                            user = emailUser; // login
                        } else {
                            logger.warnf("🚫 Utente con email %s già presente ma non federato", identity.getEmail());
                            Response jsonError = Response
                            .status(Response.Status.CONFLICT)
                            .entity("{\"error\":\"EMAIL_CONFLICT\", \"message\": \"Utente esistente con email non federata.\"}")
                            .type("application/json")
                            .build();
        
                        context.failure(AuthenticationFlowError.USER_CONFLICT, jsonError);
                        return;
                        }
                    } catch (Exception e) {
                        logger.warn("⚠️ FederatedIdentity lookup fallita", e);
                        Response jsonError = Response
                        .status(Response.Status.INTERNAL_SERVER_ERROR)
                        .entity("{\"error\":\"FEDERATION_LOOKUP_FAILED\", \"message\": \"Errore nel controllo federazione utente.\"}")
                        .type("application/json")
                        .build();
        
                    context.failure(AuthenticationFlowError.IDENTITY_PROVIDER_ERROR, jsonError);
                    return;
                    }
                }
            }
            
            if (user == null) {
                user = session.users().addUser(realm, username);
                user.setEnabled(true);
            
                if (identity.getEmail() != null) user.setEmail(identity.getEmail());
                if (identity.getFirstName() != null) user.setFirstName(identity.getFirstName());
                if (identity.getLastName() != null) user.setLastName(identity.getLastName());
                user.setEmailVerified(true);
            
                session.users().addFederatedIdentity(realm, user, model);
                isNew = true;
            }

            final UserModel createdUser = user;

            if (isNew) {
                provider.importNewUser(session, realm, createdUser, identity);

                session.identityProviders()
                    .getMappersByAliasStream(GOOGLE_ALIAS)
                    .forEach(mapper -> {
                        ProviderFactory<?> rawFactory = session.getKeycloakSessionFactory()
                            .getProviderFactory(IdentityProviderMapper.class, mapper.getIdentityProviderMapper());

                        if (rawFactory instanceof IdentityProviderMapper mapperFactory) {
                            mapperFactory.importNewUser(session, realm, createdUser, mapper, identity);
                        } else {
                            logger.warnf("⚠️ Mapper non valido per %s", mapper.getIdentityProviderMapper());
                        }
                    });
            } else {
                // Sync se FORZATO
                String syncMode = idpModel.getConfig().get("syncMode");
                if ("FORCE".equalsIgnoreCase(syncMode)) {
                    if (identity.getFirstName() != null) createdUser.setFirstName(identity.getFirstName());
                    if (identity.getLastName() != null) createdUser.setLastName(identity.getLastName());
                    if (identity.getEmail() != null) createdUser.setEmail(identity.getEmail());
                }
            }

            context.setUser(createdUser);
            context.success();

        } catch (Exception e) {
            logger.error("❌ Errore durante autenticazione federata Google", e);
            context.failure(AuthenticationFlowError.IDENTITY_PROVIDER_ERROR);
        }
    }

    @Override
    public void action(AuthenticationFlowContext context) {}

    @Override
    public boolean requiresUser() {
        return false;
    }

    @Override
    public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) {
        return true;
    }

    @Override
    public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {}

    @Override
    public void close() {}
}
