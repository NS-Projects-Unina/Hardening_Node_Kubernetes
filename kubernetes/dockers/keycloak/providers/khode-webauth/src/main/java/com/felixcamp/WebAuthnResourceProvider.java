package com.felixcamp;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.jbosslog.JBossLog;
import org.keycloak.models.KeycloakSession;
import org.keycloak.services.resource.RealmResourceProvider;

import java.util.Map;

@RequiredArgsConstructor
@JBossLog
public class WebAuthnResourceProvider implements RealmResourceProvider {

    private final KeycloakSession session;
    private final WebAuthnResourceService service;

    public WebAuthnResourceProvider(KeycloakSession session) {
        this.session = session;
        this.service = new WebAuthnResourceService(session);
    }

    @Override
    public Object getResource() {
        return this;
    }

    // ✅ Ottieni opzioni di registrazione
    @GET
    @Path("webauthn/passwordless/registration/options")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getRegistrationOptions() {
        return service.getRegistrationOptions();
    }

    // ✅ Registra una nuova credenziale
    @POST
    @Path("webauthn/passwordless/register")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response registerCredential(Map<String, Object> body) {
        return service.registerCredential(body);
    }

    // ✅ Recupera le credenziali WebAuthn dell'utente autenticato
    @GET
    @Path("webauthn/passwordless/devices")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getDevices() {
        return service.getDevices();
    }

    // ✅ Elimina una credenziale specifica per ID
    @DELETE
    @Path("webauthn/passwordless/devices/{id}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response deleteDevice(@PathParam("id") String internalId) {
        return service.deleteDevice(internalId);
    }

    // ✅ Modifica l'etichetta di una credenziale specifica per ID
    @PATCH
    @Path("/webauthn/devices/{internalId}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response updateCredentialLabel(@PathParam("internalId") String internalId, Map<String, String> body) {
        return service.updateCredentialLabel(internalId, body);
    }


    // ✅ Ottieni opzioni di autenticazione
    @GET
    @Path("webauthn/passwordless/authentication/options/{userId}")
    @Produces(MediaType.APPLICATION_JSON)
    public Response getAuthenticationOptions(@PathParam("userId") String userId) {
        return service.getAuthenticationOptionsForUser(userId);
    }

    // ✅ Verifica l'autenticazione
    @POST
    @Path("webauthn/passwordless/authentication/verify")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    public Response verifyAuthentication(Map<String, String> body) {
        String email = body.get("email");
        return service.verifyAuthentication(email, body);
    }


    @Override
    public void close() {}
}
