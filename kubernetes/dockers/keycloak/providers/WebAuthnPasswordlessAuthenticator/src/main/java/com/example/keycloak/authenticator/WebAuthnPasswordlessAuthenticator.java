package com.example.keycloak.authenticator;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.webauthn4j.data.AuthenticationRequest;
import com.webauthn4j.data.client.Origin;
import com.webauthn4j.data.client.challenge.DefaultChallenge;
import com.webauthn4j.server.ServerProperty;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.Response;
import org.jboss.logging.Logger;
import org.keycloak.WebAuthnConstants;
import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.authentication.Authenticator;
import org.keycloak.common.util.Base64Url;
import org.keycloak.credential.WebAuthnCredentialModelInput;
import org.keycloak.models.*;
import org.keycloak.models.credential.WebAuthnCredentialModel;

import java.nio.charset.StandardCharsets;
import java.util.*;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class WebAuthnPasswordlessAuthenticator implements Authenticator {

    private static final Logger logger = Logger.getLogger(WebAuthnPasswordlessAuthenticator.class);
    private static final ObjectMapper mapper = new ObjectMapper();

    @Override
    public void authenticate(AuthenticationFlowContext context) {
        MultivaluedMap<String, String> form = context.getHttpRequest().getDecodedFormParameters();
        String username = form.getFirst("username");
        String payload = form.getFirst("password");

        if (username == null || payload == null) {
            logger.warn("Missing username or WebAuthn payload.");
            context.failure(AuthenticationFlowError.INVALID_USER);
            return;
        }

        UserModel user = context.getSession().users().getUserByUsername(context.getRealm(), username);

        if (user == null || !user.isEnabled()) {
            logger.warnf("❌ User not found or disabled: %s", username);
            context.failure(AuthenticationFlowError.INVALID_USER);
            return;
        }

        context.setUser(user); // Obbligatorio per OTP o altri step successivi

        try {
            boolean valid = validateWebAuthnToken(context.getRealm(), user, payload);
            if (!valid) {
                logger.warnf("❌ Invalid WebAuthn token for user: %s", username);
                sendErrorResponse(context, "webauthn_invalid", "Invalid WebAuthn token");
                return;
            }

            logger.infof("✅ WebAuthn token valid for user: %s", username);
            context.success(); // Passa allo step successivo (es. OTP se configurato)

        } catch (Exception e) {
            logger.error("❌ Unexpected error during WebAuthn validation", e);
            sendErrorResponse(context, "internal_error", "Unexpected WebAuthn validation error");
        }
    }

    private boolean validateWebAuthnToken(RealmModel realm, UserModel user, String encodedPayload) {
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(encodedPayload);
            String json = new String(decoded, StandardCharsets.UTF_8);

            Map<String, String> body = mapper.readValue(json, Map.class);

            byte[] credentialId = Base64Url.decode(body.get("id"));
            byte[] clientDataJSON = Base64Url.decode(body.get("clientDataJSON"));
            byte[] authenticatorData = Base64Url.decode(body.get("authenticatorData"));
            byte[] signature = Base64Url.decode(body.get("signature"));
            String userHandleEncoded = body.get("userHandle");

            if (userHandleEncoded != null) {
                String decodedHandle = new String(Base64Url.decode(userHandleEncoded), StandardCharsets.UTF_8);
                if (!decodedHandle.equals(user.getId())) {
                    logger.warn("❌ User handle mismatch.");
                    return false;
                }
            }

            WebAuthnPolicy policy = realm.getWebAuthnPolicyPasswordless();
            Set<Origin> origins = new HashSet<>();
            origins.add(new Origin("https://" + policy.getRpId()));
            for (String extra : policy.getExtraOrigins()) {
                origins.add(new Origin(extra));
            }

            String storedChallenge = user.getFirstAttribute("pending_webauthn_loginchallenge");
            if (storedChallenge == null) {
                logger.warn("❌ Missing challenge on user model.");
                return false;
            }

            ServerProperty serverProperty = new ServerProperty(
                origins,
                policy.getRpId(),
                new DefaultChallenge(storedChallenge),
                null
            );

            AuthenticationRequest authenticationRequest = new AuthenticationRequest(
                credentialId, authenticatorData, clientDataJSON, signature
            );

            WebAuthnCredentialModelInput.KeycloakWebAuthnAuthenticationParameters params =
                    new WebAuthnCredentialModelInput.KeycloakWebAuthnAuthenticationParameters(
                            serverProperty,
                            WebAuthnConstants.OPTION_REQUIRED.equals(policy.getUserVerificationRequirement())
                    );

            WebAuthnCredentialModelInput credentialInput =
                    new WebAuthnCredentialModelInput(WebAuthnCredentialModel.TYPE_PASSWORDLESS);
            credentialInput.setAuthenticationRequest(authenticationRequest);
            credentialInput.setAuthenticationParameters(params);

            boolean result = user.credentialManager().isValid(credentialInput);

            if (result) {
                user.removeAttribute("pending_webauthn_loginchallenge");
            }

            return result;

        } catch (Exception e) {
            logger.error("❌ WebAuthn token validation failed", e);
            return false;
        }
    }

    private void sendErrorResponse(AuthenticationFlowContext context, String errorCode, String message) {
        try {
            ObjectNode jsonResponse = mapper.createObjectNode();
            jsonResponse.put("status", errorCode);
            jsonResponse.put("message", message);
            jsonResponse.put("error", errorCode);

            Response challenge = Response.status(Response.Status.UNAUTHORIZED)
                    .header("Content-Type", "application/json")
                    .entity(jsonResponse.toString())
                    .build();

            logger.infof("📤 Sending error response [%s]: %s", errorCode, message);
            context.failure(AuthenticationFlowError.INVALID_CREDENTIALS, challenge);
        } catch (Exception e) {
            logger.error("⚠️ Error building error response", e);
            context.failure(AuthenticationFlowError.INTERNAL_ERROR);
        }
    }

    @Override public void action(AuthenticationFlowContext context) {}
    @Override public boolean requiresUser() { return false; }
    @Override public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) { return true; }
    @Override public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {}
    @Override public void close() {}
}
