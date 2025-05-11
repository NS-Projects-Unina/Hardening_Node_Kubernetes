package com.example.keycloak;

import org.keycloak.Config.Scope;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventListenerProviderFactory;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;

public class UserSyncEventListenerProviderFactory implements EventListenerProviderFactory {

    private String dbUrl;
    private String dbUser;
    private String dbPassword;

    @Override
    public EventListenerProvider create(KeycloakSession session) {
        return new UserSyncEventListenerProvider(session, dbUrl, dbUser, dbPassword);
    }

    @Override
    public void init(Scope config) {
        String host = getEnvOrFail("EXTERNAL_DB_HOST");
        String port = getEnvOrFail("EXTERNAL_DB_PORT");
        String dbName = getEnvOrFail("EXTERNAL_DB_NAME");
    
        dbUrl = String.format("jdbc:postgresql://%s:%s/%s", host, port, dbName);
        dbUser = getEnvOrFail("EXTERNAL_DB_USER");
        dbPassword = getEnvOrFail("EXTERNAL_DB_PASSWORD");
    }

    private String getEnvOrFail(String varName) {
        String value = System.getenv(varName);
        if (value == null || value.isEmpty()) {
            throw new IllegalArgumentException("Environment variable " + varName + " is required but not set.");
        }
        return value;
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) {}
    @Override
    public void close() {}
    @Override
    public String getId() {
        return "user_sync_event_listener";
    }
}
