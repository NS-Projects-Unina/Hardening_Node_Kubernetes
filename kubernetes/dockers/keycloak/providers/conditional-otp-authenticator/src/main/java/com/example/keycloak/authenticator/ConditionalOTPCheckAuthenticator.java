package com.example.keycloak.authenticator;

import org.keycloak.authentication.AuthenticationFlowContext;
import org.keycloak.authentication.AuthenticationFlowError;
import org.keycloak.authentication.Authenticator;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.keycloak.credential.CredentialProvider;
import org.keycloak.credential.OTPCredentialProvider;
import org.jboss.logging.Logger;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

import jakarta.ws.rs.core.Response;
import java.util.regex.Pattern;

public class ConditionalOTPCheckAuthenticator implements Authenticator {

    private static final Logger logger = Logger.getLogger(ConditionalOTPCheckAuthenticator.class);
    private static final ObjectMapper mapper = new ObjectMapper();
    private static final Pattern OTP_6_DIGITS = Pattern.compile("\\b\\d{6}\\b");

    @Override
    public void authenticate(AuthenticationFlowContext context) {
        UserModel user = context.getUser();

        if (user == null) {
            logger.info("No user in context. Marking as attempted.");
            context.attempted();
            return;
        }

        logger.infof("Conditional OTP Check running for user: %s", user.getUsername());

        boolean otpConfigured = isOTPConfigured(context.getSession(), context.getRealm(), user);
        logger.infof("OTP configured for user %s: %s", user.getUsername(), otpConfigured);

        String otp = context.getHttpRequest().getDecodedFormParameters().getFirst("otp");
        logger.infof("OTP received for user %s: %s", user.getUsername(), otp);

        if (!otpConfigured) {
            logger.infof("User %s has no OTP configured. Skipping OTP step.", user.getUsername());
            context.success();
            return;
        }

        if (otp == null || otp.trim().isEmpty()) {
            logger.warnf("OTP required but not provided for user %s", user.getUsername());
            sendErrorResponse(context, "otp_required", "OTP required to complete authentication");
            return;
        }

        if (!OTP_6_DIGITS.matcher(otp).find()) {
            logger.warnf("Invalid OTP format for user %s: '%s'", user.getUsername(), otp);
            sendErrorResponse(context, "otp_invalid", "OTP must be a 6-digit number");
            return;
        }

        logger.infof("OTP present and valid format for user %s. Continuing to OTP verification step.", user.getUsername());
        context.success(); // Let Keycloak's OTP step verify it
    }

    private boolean isOTPConfigured(KeycloakSession session, RealmModel realm, UserModel user) {
        OTPCredentialProvider otpProvider = (OTPCredentialProvider)
                session.getProvider(CredentialProvider.class, "keycloak-otp");
        return otpProvider.isConfiguredFor(realm, user);
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

            logger.infof("Sending error response [%s]: %s", errorCode, message);
            context.failure(AuthenticationFlowError.ACCESS_DENIED, challenge);  // <-- QUESTO È IL PUNTO CHIAVE

        } catch (Exception e) {
            logger.error("Error building error response", e);
            context.failure(AuthenticationFlowError.INTERNAL_ERROR);
        }
    }

    @Override public void action(AuthenticationFlowContext context) {}
    @Override public boolean requiresUser() { return true; }
    @Override public boolean configuredFor(KeycloakSession session, RealmModel realm, UserModel user) { return true; }
    @Override public void setRequiredActions(KeycloakSession session, RealmModel realm, UserModel user) {}
    @Override public void close() {}
}
