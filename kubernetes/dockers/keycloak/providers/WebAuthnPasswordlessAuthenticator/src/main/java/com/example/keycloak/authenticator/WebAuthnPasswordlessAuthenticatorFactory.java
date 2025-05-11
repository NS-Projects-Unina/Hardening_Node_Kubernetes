package com.example.keycloak.authenticator;

import org.keycloak.authentication.Authenticator;
import org.keycloak.authentication.AuthenticatorFactory;
import org.keycloak.models.AuthenticationExecutionModel.Requirement;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;
import org.keycloak.provider.ProviderConfigProperty;

import java.util.Collections;
import java.util.List;

public class WebAuthnPasswordlessAuthenticatorFactory implements AuthenticatorFactory {

    public static final String PROVIDER_ID = "webauthn-passwordless-authenticator";
    private static final WebAuthnPasswordlessAuthenticator SINGLETON = new WebAuthnPasswordlessAuthenticator();

    @Override
    public String getId() {
        return PROVIDER_ID;
    }

    @Override
    public String getDisplayType() {
        return "WebAuthn Passwordless Authenticator";
    }

    @Override
    public String getHelpText() {
        return "Authenticates a user with a passwordless WebAuthn token.";
    }

    @Override
    public String getReferenceCategory() {
        return "webauthn";
    }

    @Override
    public boolean isConfigurable() {
        return false;
    }

    @Override
    public Requirement[] getRequirementChoices() {
        return new Requirement[] {
            Requirement.REQUIRED,
            Requirement.ALTERNATIVE,
            Requirement.DISABLED
        };
    }

    @Override public boolean isUserSetupAllowed() { return false; }
    @Override public List<ProviderConfigProperty> getConfigProperties() { return Collections.emptyList(); }
    @Override public Authenticator create(KeycloakSession session) { return SINGLETON; }
    @Override public void init(org.keycloak.Config.Scope config) {}
    @Override public void postInit(KeycloakSessionFactory factory) {}
    @Override public void close() {}
}
