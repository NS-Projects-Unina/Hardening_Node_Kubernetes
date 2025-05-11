package com.example.keycloak;

import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.UserModel;

import com.fasterxml.jackson.databind.ObjectMapper;

import javax.net.ssl.*;
import java.security.cert.X509Certificate;
import java.sql.*;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public class UserSyncEventListenerProvider implements EventListenerProvider {

    private final String dbUrl;
    private final String dbUser;
    private final String dbPassword;
    private final KeycloakSession session;
    private final ObjectMapper mapper = new ObjectMapper();

    public UserSyncEventListenerProvider(KeycloakSession session, String dbUrl, String dbUser, String dbPassword) {
        this.dbUrl = dbUrl;
        this.dbUser = dbUser;
        this.dbPassword = dbPassword;
        this.session = session;
        disableCertificateValidation();
    }

    @Override
    public void onEvent(Event event) {
        if ("LOGIN".equals(event.getType().toString())) {
            String userId = event.getUserId();

            try (Connection conn = DriverManager.getConnection(dbUrl, dbUser, dbPassword)) {
                UserModel user = session.users().getUserById(session.getContext().getRealm(), userId);
                if (user != null) {
                    String username = user.getUsername();
                    String email = user.getEmail();
                    insertUser(userId, username, email);
                }
            } catch (Exception e) {
                System.err.println("DB error during login sync: " + abbreviateSqlException(e));
            }
        }
    }

    @Override
    public void onEvent(AdminEvent adminEvent, boolean includeRepresentation) {
        if (adminEvent.getResourceTypeAsString().equals("USER")) {
            String userId = extractUserIdFromResourcePath(adminEvent.getResourcePath());

            if ("CREATE".equals(adminEvent.getOperationType().toString())) {
                String json = adminEvent.getRepresentation();
                if (json != null) {
                    try {
                        Map<String, Object> data = mapper.readValue(json, HashMap.class);
                        String username = (String) data.getOrDefault("username", null);
                        String email = (String) data.getOrDefault("email", username);
                        insertUser(userId, username, email);
                    } catch (Exception e) {
                        System.err.println("DB error during user creation: " + abbreviateSqlException(e));
                    }
                }
            }

            if ("UPDATE".equals(adminEvent.getOperationType().toString())) {
                String json = adminEvent.getRepresentation();
                if (json != null) {
                    try {
                        Map<String, Object> data = mapper.readValue(json, HashMap.class);

                        if (data.containsKey("enabled")) {
                            Object enabledObj = data.get("enabled");
                            if (enabledObj != null) {
                                boolean enabled = Boolean.parseBoolean(enabledObj.toString());
                                updateUserEnabledFlag(userId, enabled);
                            }
                        }

                        if (data.containsKey("username")) {
                            Object usernameObj = data.get("username");
                            if (usernameObj != null) {
                                String username = usernameObj.toString();
                                updateUserUsername(userId, username);
                            }
                        }

                        if (data.containsKey("email")) {
                            Object emailObj = data.get("email");
                            if (emailObj != null) {
                                String email = emailObj.toString();
                                updateUserEmail(userId, email);
                            }
                        }

                    } catch (Exception e) {
                        System.err.println("Error processing admin update: " + e.getMessage());
                    }
                }
            }
        }
    }

    @Override
    public void close() {}

    private void insertUser(String userId, String username, String email) {
        try (Connection conn = DriverManager.getConnection(dbUrl, dbUser, dbPassword)) {
            String query = "INSERT INTO users (id, username, email, created_at, updated_at) " +
                           "VALUES (?, ?, ?, ?, ?) " +
                           "ON CONFLICT (id) DO NOTHING";
            try (PreparedStatement stmt = conn.prepareStatement(query)) {
                stmt.setObject(1, UUID.fromString(userId));
                stmt.setString(2, username);
                stmt.setString(3, email);
                Timestamp now = new Timestamp(System.currentTimeMillis());
                stmt.setTimestamp(4, now);
                stmt.setTimestamp(5, now);
                stmt.executeUpdate();
                System.out.println("User inserted into DB (if not exists): " + username);
            }
        } catch (SQLException e) {
            System.err.println("insertUser: " + abbreviateSqlException(e));
        }
    }

    private void updateUserEnabledFlag(String userId, boolean enabled) {
        try (Connection conn = DriverManager.getConnection(dbUrl, dbUser, dbPassword)) {
            String query = "UPDATE users SET enabled = ?, updated_at = NOW() WHERE id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(query)) {
                stmt.setBoolean(1, enabled);
                stmt.setObject(2, UUID.fromString(userId), java.sql.Types.OTHER);
                stmt.executeUpdate();
                System.out.println("User " + userId + " updated (enabled=" + enabled + ")");
            }
        } catch (SQLException e) {
            System.err.println("updateUserEnabledFlag: " + abbreviateSqlException(e));
        }
    }

    private void updateUserUsername(String userId, String username) {
        try (Connection conn = DriverManager.getConnection(dbUrl, dbUser, dbPassword)) {
            String query = "UPDATE users SET username = ?, updated_at = NOW() WHERE id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(query)) {
                stmt.setString(1, username);
                stmt.setObject(2, UUID.fromString(userId), java.sql.Types.OTHER);
                stmt.executeUpdate();
                System.out.println("User " + userId + " updated (username=" + username + ")");
            }
        } catch (SQLException e) {
            System.err.println("updateUserUsername: " + abbreviateSqlException(e));
        }
    }

    private void updateUserEmail(String userId, String email) {
        try (Connection conn = DriverManager.getConnection(dbUrl, dbUser, dbPassword)) {
            String query = "UPDATE users SET email = ?, updated_at = NOW() WHERE id = ?";
            try (PreparedStatement stmt = conn.prepareStatement(query)) {
                stmt.setString(1, email);
                stmt.setObject(2, UUID.fromString(userId), java.sql.Types.OTHER);
                stmt.executeUpdate();
                System.out.println("User " + userId + " updated (email=" + email + ")");
            }
        } catch (SQLException e) {
            System.err.println("updateUserEmail: " + abbreviateSqlException(e));
        }
    }

    private String extractUserIdFromResourcePath(String resourcePath) {
        if (resourcePath != null && resourcePath.contains("/")) {
            return resourcePath.substring(resourcePath.lastIndexOf("/") + 1);
        }
        return resourcePath;
    }

    private String abbreviateSqlException(Exception e) {
        String msg = e.getMessage();
        String cause = e.getCause() != null ? e.getCause().getMessage() : "";
        return msg + (cause.isEmpty() ? "" : " | Cause: " + cause);
    }

    private void disableCertificateValidation() {
        try {
            TrustManager[] trustAllCerts = new TrustManager[]{ new X509TrustManager() {
                public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                public X509Certificate[] getAcceptedIssuers() { return null; }
            }};
            SSLContext sc = SSLContext.getInstance("SSL");
            sc.init(null, trustAllCerts, new java.security.SecureRandom());
            HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());
            HttpsURLConnection.setDefaultHostnameVerifier((hostname, session) -> true);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
