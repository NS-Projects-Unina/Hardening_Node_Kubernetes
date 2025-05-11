package com.felixcamp;

import jakarta.ws.rs.NotAuthorizedException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ForbiddenException;
import org.jboss.logging.Logger;
import org.keycloak.WebAuthnConstants;
import org.keycloak.authentication.CredentialRegistrator;
import org.keycloak.common.util.Base64Url;
import org.keycloak.credential.WebAuthnCredentialModelInput;
import org.keycloak.credential.WebAuthnCredentialProvider;
import org.keycloak.credential.WebAuthnPasswordlessCredentialProviderFactory;
import org.keycloak.models.*;
import org.keycloak.models.credential.WebAuthnCredentialModel;
import org.keycloak.services.managers.AppAuthManager;
import org.keycloak.services.managers.AuthenticationManager.AuthResult;
import org.keycloak.credential.CredentialModel;
import org.keycloak.credential.CredentialProvider;

import com.webauthn4j.WebAuthnRegistrationManager;
import com.webauthn4j.data.AuthenticationRequest;
import com.webauthn4j.converter.util.ObjectConverter;
import com.webauthn4j.data.RegistrationData;
import com.webauthn4j.data.RegistrationParameters;
import com.webauthn4j.data.RegistrationRequest;
import com.webauthn4j.data.client.Origin;
import com.webauthn4j.data.client.challenge.DefaultChallenge;
import com.webauthn4j.server.ServerProperty;
import com.webauthn4j.util.exception.WebAuthnException;
import com.webauthn4j.validator.attestation.statement.androidkey.AndroidKeyAttestationStatementValidator;
import com.webauthn4j.validator.attestation.statement.androidsafetynet.AndroidSafetyNetAttestationStatementValidator;
import com.webauthn4j.validator.attestation.statement.none.NoneAttestationStatementValidator;
import com.webauthn4j.validator.attestation.statement.packed.PackedAttestationStatementValidator;
import com.webauthn4j.validator.attestation.statement.tpm.TPMAttestationStatementValidator;
import com.webauthn4j.validator.attestation.statement.u2f.FIDOU2FAttestationStatementValidator;
import com.webauthn4j.validator.attestation.trustworthiness.certpath.NullCertPathTrustworthinessValidator;
import com.webauthn4j.validator.attestation.trustworthiness.self.DefaultSelfAttestationTrustworthinessValidator;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

public class WebAuthnResourceService {

    private static final Logger logger = Logger.getLogger(WebAuthnResourceService.class);

    private final KeycloakSession session;
    private final RealmModel realm;

    public WebAuthnResourceService(KeycloakSession session) {
        this.session = session;
        this.realm = session.getContext().getRealm();
    }


    private void checkServiceAccountOnly() {
    AuthResult auth = new AppAuthManager.BearerTokenAuthenticator(session).authenticate();
    if (auth == null) throw new NotAuthorizedException("Bearer token required");

    UserModel user = auth.getUser();
    if (user == null || user.getServiceAccountClientLink() == null) {
        throw new ForbiddenException("Access denied: service account required");
    }
}

    // ✅ Ottieni opzioni di registrazione
    public Response getRegistrationOptions() {
        AuthResult auth = new AppAuthManager.BearerTokenAuthenticator(session).authenticate();
        if (auth == null || auth.getUser() == null) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity(Map.of("error", "Bearer token required"))
                    .build();
        }
    
        UserModel user = auth.getUser();
        WebAuthnPolicy policy = realm.getWebAuthnPolicyPasswordless();
    
        // Genera nuova challenge
        DefaultChallenge challenge = new DefaultChallenge();
        String encodedChallenge = Base64Url.encode(challenge.getValue());
    
        // Salva challenge come attributo utente
        user.setSingleAttribute("pending_webauthn_challenge", encodedChallenge);
        // 👇 Costruisce la lista di credenziali da escludere per evitare di registrare lo stesso dispositivo

        // 🔍 Recupera le credenziali già registrate dall'utente
        List<CredentialModel> storedCredentials = user.credentialManager()
        .getStoredCredentialsByTypeStream(WebAuthnCredentialModel.TYPE_PASSWORDLESS)
        .toList();

        List<Map<String, Object>> excludeCredentials = storedCredentials.stream()
        .map(WebAuthnCredentialModel::createFromCredentialModel)
        .map(cred -> {
        Map<String, Object> credMap = new HashMap<>();
        credMap.put("type", "public-key");
        credMap.put("id", Base64Url.decode(cred.getWebAuthnCredentialData().getCredentialId()));
        return credMap;
        })
        .collect(Collectors.toList()); // 💥 evita il cast errato

    
        // Costruisci response per il client WebAuthn API
        Map<String, Object> options = new HashMap<>();
        options.put("challenge", encodedChallenge);
        options.put("rp", Map.of("name", realm.getDisplayName(), "id", policy.getRpId()));
        options.put("user", Map.of(
                "id", Base64Url.encode(user.getId().getBytes(StandardCharsets.UTF_8)),
                "name", user.getUsername(),
                "displayName", user.getFirstName() + " " + user.getLastName()
        ));
        options.put("pubKeyCredParams", List.of(Map.of("type", "public-key", "alg", -7)));
        options.put("authenticatorSelection", Map.of(
                "residentKey", policy.getRequireResidentKey(),
                "userVerification", policy.getUserVerificationRequirement()
        ));
        options.put("attestation", "none");
        options.put("timeout", policy.getCreateTimeout());
        options.put("excludeCredentials", excludeCredentials);
    
        return Response.ok(options).build();
    }
 
    
    // ✅ Registra una nuova credenziale
    public Response registerCredential(Map<String, Object> body) {
        try {
            AuthResult auth = new AppAuthManager.BearerTokenAuthenticator(session).authenticate();
            if (auth == null || auth.getUser() == null) {
                return Response.status(Response.Status.UNAUTHORIZED)
                        .entity(Map.of("error", "Bearer token required"))
                        .build();
            }

            UserModel user = auth.getUser();
            WebAuthnPolicy policy = realm.getWebAuthnPolicyPasswordless();

            Map<String, String> response = (Map<String, String>) body.get("response");
            byte[] clientDataJSON = Base64Url.decode(response.get("clientDataJSON"));
            byte[] attestationObject = Base64Url.decode(response.get("attestationObject"));

            String storedChallenge = user.getFirstAttribute("pending_webauthn_challenge");
            if (storedChallenge == null) {
                return Response.status(Response.Status.BAD_REQUEST)
                        .entity(Map.of("error", "No stored challenge for user"))
                        .build();
            }

            DefaultChallenge challenge = new DefaultChallenge(storedChallenge);
         //   Origin origin = new Origin("https://" + policy.getRpId()); Costruisce il set degli origin validi (come fa Keycloak internamente)
            
            Set<Origin> allOrigins = new HashSet<>();
            allOrigins.add(new Origin("https://" + policy.getRpId()));
            for (String extraOrigin : policy.getExtraOrigins()) {
                allOrigins.add(new Origin(extraOrigin));
            }
            ServerProperty serverProperty = new ServerProperty(allOrigins, policy.getRpId(), challenge, null);

            WebAuthnRegistrationManager registrationManager = new WebAuthnRegistrationManager(
                    Arrays.asList(
                            new NoneAttestationStatementValidator(),
                            new PackedAttestationStatementValidator(),
                            new TPMAttestationStatementValidator(),
                            new AndroidKeyAttestationStatementValidator(),
                            new AndroidSafetyNetAttestationStatementValidator(),
                            new FIDOU2FAttestationStatementValidator()
                    ),
                    new NullCertPathTrustworthinessValidator(),
                    new DefaultSelfAttestationTrustworthinessValidator(),
                    Collections.emptyList(),
                    new ObjectConverter()
            );

            List<String> transportsList = (List<String>) body.get("transports");
            Set<String> transportSet = transportsList != null ? new HashSet<>(transportsList) : Collections.emptySet();
            RegistrationRequest registrationRequest = new RegistrationRequest(attestationObject, clientDataJSON,transportSet);
            RegistrationParameters registrationParameters = new RegistrationParameters(
                    serverProperty,
                    policy.getUserVerificationRequirement().equals("required")
            );

            RegistrationData registrationData = registrationManager.validate(
                    registrationManager.parse(registrationRequest),
                    registrationParameters
            );

            WebAuthnCredentialModelInput credential = new WebAuthnCredentialModelInput(WebAuthnCredentialModel.TYPE_PASSWORDLESS);
            credential.setAttestedCredentialData(registrationData.getAttestationObject().getAuthenticatorData().getAttestedCredentialData());
            credential.setCount(registrationData.getAttestationObject().getAuthenticatorData().getSignCount());
            credential.setAttestationStatementFormat(registrationData.getAttestationObject().getFormat());
            credential.setTransports(registrationData.getTransports());

            WebAuthnCredentialProvider provider = (WebAuthnCredentialProvider) session.getProvider(
                    CredentialProvider.class,
                    WebAuthnPasswordlessCredentialProviderFactory.PROVIDER_ID
            );

            // Recupera tutte le credenziali WebAuthn dell'utente
            List<CredentialModel> storedCredentials = user.credentialManager()
                    .getStoredCredentialsByTypeStream(WebAuthnCredentialModel.TYPE_PASSWORDLESS)
                    .toList();
            // 🔍 Log delle credenziali esistenti
            logger.infof("🧠 Credenziali già registrate per %s:", user.getUsername());
            storedCredentials.stream()
            .map(WebAuthnCredentialModel::createFromCredentialModel)
            .forEach(cred -> {
                String encodedId = cred.getWebAuthnCredentialData().getCredentialId(); // già base64url!
                String label = cred.getUserLabel();
                logger.infof("🆔 ID: %s | Label: %s", encodedId, label);
            });
            // Controllo duplicato per label
            String label = (String) body.get("label");
            if (label != null && !label.isBlank()) {
                boolean labelUsed = storedCredentials.stream()
                        .map(WebAuthnCredentialModel::createFromCredentialModel)
                        .anyMatch(cred -> label.equals(cred.getUserLabel()));

                if (labelUsed) {
                    logger.warnf("⚠️ Label già usata: %s", label);
                    return Response.status(Response.Status.CONFLICT)
                            .entity(Map.of("error", "label_already_used"))
                            .build();
                }
            }

            WebAuthnCredentialModel newCredentialModel = provider.getCredentialModelFromCredentialInput(credential, (String) body.get("label"));
            provider.createCredential(realm, user, newCredentialModel);

            user.removeAttribute("pending_webauthn_challenge");

            return Response.ok(Map.of("status", "registered", "label", body.get("label"))).build();

        } catch (WebAuthnException e) {
            logger.error("❌ WebAuthn validation failed", e);
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", e.getClass().getSimpleName(), "details", e.getMessage()))
                    .build();
        } catch (Exception e) {
            logger.error("❌ General WebAuthn error", e);
            return Response.status(500)
                    .entity(Map.of("error", "internal_error", "details", e.getMessage()))
                    .build();
        }
    }





    // ✅ Ottieni opzioni di autenticazione
    public Response getAuthenticationOptionsForUser(String userId) {
        // 🔒 Verifica che sia un token di service account
        try {
            checkServiceAccountOnly();
        } catch (NotAuthorizedException | ForbiddenException e) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity(Map.of("error", "Access denied: service account required"))
                    .build();
        }
        UserModel user = session.users().getUserById(realm, userId);
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(Map.of("error", "User not found"))
                    .build();
        }
    
        WebAuthnPolicy policy = realm.getWebAuthnPolicyPasswordless();
    
        DefaultChallenge challenge = new DefaultChallenge();
        String encodedChallenge = Base64Url.encode(challenge.getValue());
    
        // Salva la challenge nell'attributo dell'utente
        user.setSingleAttribute("pending_webauthn_loginchallenge", encodedChallenge);
    
        List<CredentialModel> credentials = user.credentialManager()
                .getStoredCredentialsByTypeStream(WebAuthnCredentialModel.TYPE_PASSWORDLESS)
                .toList();
    
        List<Map<String, Object>> allowCredentials = credentials.stream()
                .map(WebAuthnCredentialModel::createFromCredentialModel)
                .map(cred -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("type", "public-key");
                    map.put("id", Base64Url.decode(cred.getWebAuthnCredentialData().getCredentialId()));
                    return map;
                }).toList();
    
        Map<String, Object> options = new HashMap<>();
        options.put("challenge", encodedChallenge);
        options.put("rpId", policy.getRpId());
        options.put("timeout", policy.getCreateTimeout());
        options.put("allowCredentials", allowCredentials);
        options.put("userVerification", policy.getUserVerificationRequirement());
    
        return Response.ok(options).build();
   
    }



    // ✅ Verifica autenticazione WebAuthn
    public Response verifyAuthentication(String email, Map<String, String> body) {
        // 🔐 Verifica token del service account
        try {
            checkServiceAccountOnly();
        } catch (NotAuthorizedException | ForbiddenException e) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity(Map.of("error", "Access denied: service account required"))
                    .build();
        }
    
        if (email == null || email.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "email_required"))
                    .build();
        }
    
        // 🔍 Trova l’utente via email (corretto)
        UserModel user = session.users().getUserByEmail(realm, email);
    
        if (user == null) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(Map.of("error", "user_not_found"))
                    .build();
        }
    
        String storedChallenge = user.getFirstAttribute("pending_webauthn_loginchallenge");
        if (storedChallenge == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "missing_challenge"))
                    .build();
        }
    
        try {
            // 🔧 Prepara challenge e ServerProperty
            DefaultChallenge challenge = new DefaultChallenge(storedChallenge);
            WebAuthnPolicy policy = realm.getWebAuthnPolicyPasswordless();
    
            Set<Origin> origins = new HashSet<>();
            origins.add(new Origin("https://" + policy.getRpId()));
            for (String extra : policy.getExtraOrigins()) {
                origins.add(new Origin(extra));
            }
    
            ServerProperty serverProperty = new ServerProperty(origins, policy.getRpId(), challenge, null);
    
            // 🔄 Preleva dati dal body (inviato dal browser)
            byte[] credentialId = Base64Url.decode(body.get("id"));
            byte[] clientDataJSON = Base64Url.decode(body.get("clientDataJSON"));
            byte[] authenticatorData = Base64Url.decode(body.get("authenticatorData"));
            byte[] signature = Base64Url.decode(body.get("signature"));
            String userHandleEncoded = body.get("userHandle");
    
            if (userHandleEncoded != null) {
                String decodedUserHandle = new String(Base64Url.decode(userHandleEncoded), StandardCharsets.UTF_8);
                if (!decodedUserHandle.equals(user.getId())) {
                    return Response.status(Response.Status.UNAUTHORIZED)
                            .entity(Map.of("error", "user_mismatch"))
                            .build();
                }
            }
    
            // 🧠 Prepara credential input
            AuthenticationRequest authenticationRequest = new AuthenticationRequest(
                    credentialId, authenticatorData, clientDataJSON, signature);
    
            WebAuthnCredentialModelInput.KeycloakWebAuthnAuthenticationParameters params =
                    new WebAuthnCredentialModelInput.KeycloakWebAuthnAuthenticationParameters(
                            serverProperty, WebAuthnConstants.OPTION_REQUIRED.equals(policy.getUserVerificationRequirement()));
    
            WebAuthnCredentialModelInput credentialInput =
                    new WebAuthnCredentialModelInput(WebAuthnCredentialModel.TYPE_PASSWORDLESS);
    
            credentialInput.setAuthenticationRequest(authenticationRequest);
            credentialInput.setAuthenticationParameters(params);
    
            boolean valid = user.credentialManager().isValid(credentialInput);
    
            if (!valid) {
                return Response.status(Response.Status.UNAUTHORIZED)
                        .entity(Map.of("error", "invalid_credentials"))
                        .build();
            }
    
            // ✅ Successo
            user.removeAttribute("pending_webauthn_loginchallenge");
            return Response.ok(Map.of("authenticated", true)).build();
    
        } catch (WebAuthnException e) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "webauthn_exception", "details", e.getMessage()))
                    .build();
        } catch (Exception e) {
            return Response.status(500)
                    .entity(Map.of("error", "internal_error", "details", e.getMessage()))
                    .build();
        }
    }
    



























// 🔍 Lista dispositivi registrati per l'utente autenticato
public Response getDevices() {
    AuthResult auth = new AppAuthManager.BearerTokenAuthenticator(session).authenticate();
    if (auth == null || auth.getUser() == null) {
        return Response.status(Response.Status.UNAUTHORIZED)
                .entity(Map.of("error", "Bearer token required"))
                .build();
    }

    UserModel user = auth.getUser();

    List<CredentialModel> storedCredentials = user.credentialManager()
            .getStoredCredentialsByTypeStream(WebAuthnCredentialModel.TYPE_PASSWORDLESS)
            .toList();

            List<Map<String, String>> devices = storedCredentials.stream()
            .map(cm -> {
                WebAuthnCredentialModel cred = WebAuthnCredentialModel.createFromCredentialModel(cm);
                return Map.of(
                        "id", cred.getWebAuthnCredentialData().getCredentialId(),   // credentialId (pubblico)
                        "internalId", cm.getId(),                                   // <-- questo è quello che serve per delete/update
                        "label", cred.getUserLabel() != null ? cred.getUserLabel() : "Senza nome"
                );
            })
            .toList();

    return Response.ok(devices).build();
}

// ❌ Elimina dispositivo per ID
public Response deleteDevice(String internalId) {
    AuthResult auth = new AppAuthManager.BearerTokenAuthenticator(session).authenticate();
    if (auth == null || auth.getUser() == null) {
        return Response.status(Response.Status.UNAUTHORIZED)
                .entity(Map.of("error", "Bearer token required"))
                .build();
    }

    UserModel user = auth.getUser();

    boolean removed = user.credentialManager().removeStoredCredentialById(internalId);

    if (!removed) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity(Map.of("error", "Credential not found"))
                .build();
    }

    return Response.ok(Map.of("status", "deleted")).build();
}

// 🔍 Modifica nome dispositivo salvato
public Response updateCredentialLabel(String internalId, Map<String, String> body) {
    try {
        AuthResult auth = new AppAuthManager.BearerTokenAuthenticator(session).authenticate();
        if (auth == null || auth.getUser() == null) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity(Map.of("error", "Bearer token required"))
                    .build();
        }

        UserModel user = auth.getUser();
        String newLabel = body.get("label");

        if (newLabel == null || newLabel.trim().isEmpty()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Invalid label"))
                    .build();
        }

        List<CredentialModel> creds = user.credentialManager()
                .getStoredCredentialsByTypeStream(WebAuthnCredentialModel.TYPE_PASSWORDLESS)
                .toList();

        Optional<CredentialModel> target = creds.stream()
                .filter(c -> c.getId().equals(internalId))
                .findFirst();

        if (target.isEmpty()) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(Map.of("error", "Credential not found"))
                    .build();
        }

        // Controllo duplicati di label
        boolean labelUsed = creds.stream()
                .filter(c -> !c.getId().equals(internalId))
                .map(WebAuthnCredentialModel::createFromCredentialModel)
                .anyMatch(cred -> newLabel.equals(cred.getUserLabel()));

        if (labelUsed) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("error", "label_already_used"))
                    .build();
        }

        CredentialModel model = target.get();
        model.setUserLabel(newLabel);
        user.credentialManager().updateStoredCredential(model);

        return Response.ok(Map.of("status", "updated", "label", newLabel)).build();

    } catch (Exception e) {
        logger.error("Errore aggiornamento label", e);
        return Response.status(500)
                .entity(Map.of("error", "internal_error", "details", e.getMessage()))
                .build();
    }
}






}
