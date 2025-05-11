package com.khodecamp;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.jbosslog.JBossLog;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.openapi.annotations.enums.SchemaType;
import org.eclipse.microprofile.openapi.annotations.media.Content;
import org.eclipse.microprofile.openapi.annotations.media.Schema;
import org.eclipse.microprofile.openapi.annotations.responses.APIResponse;
import org.keycloak.models.KeycloakSession;
import org.keycloak.services.resource.RealmResourceProvider;

import java.util.Map;

@RequiredArgsConstructor
@JBossLog
public class KhodeResourceProvider implements RealmResourceProvider {

    private final KeycloakSession session;
    private final KhodeResourceService khodeResourceService;

    public KhodeResourceProvider(KeycloakSession session) {
        this.session = session;
        this.khodeResourceService = new KhodeResourceService(session);
    }

    @Override
    public Object getResource() {
        return this;
    }

    @Override
    public void close() {

    }

    @POST
    @Path("totp/setup/{user_id}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Setup TOTP for user")
    @APIResponse(responseCode = "200", description = "TOTP setup successful")
    @APIResponse(responseCode = "400", description = "Invalid user ID or TOTP already configured")
    @APIResponse(responseCode = "500", description = "Internal server error")
    public Response setupTotp(@PathParam("user_id") final String userid) {
        return khodeResourceService.setupTotp(userid);
    }

    @POST
    @Path("totp/verify/{user_id}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Verify and enable TOTP for user",
            description = "This endpoint verifies the TOTP code and enables TOTP for the user."
    )
    @APIResponse(
            responseCode = "200",
            description = "",
            content = {@Content(
                    schema = @Schema(
                            implementation = Response.class,
                            type = SchemaType.OBJECT
                    )
            )}
    )
    public Response verifyAndEnableTotp(@PathParam("user_id") final String userid, Map<String, String> data) {
        return khodeResourceService.verifyAndEnableTotp(userid, data);
    }

    @GET
    @Path("totp/status/{user_id}")
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Get TOTP status for user")
    @APIResponse(responseCode = "200", description = "TOTP status retrieved successfully")
    @APIResponse(responseCode = "400", description = "Invalid user ID")
    @APIResponse(responseCode = "500", description = "Internal server error")
    public Response getTotpStatus(@PathParam("user_id") final String userid) {
        return khodeResourceService.getTotpStatus(userid);
    }

    @POST
    @Path("totp/validate/{user_id}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(summary = "Validate TOTP code")
    @APIResponse(responseCode = "200", description = "TOTP code validated successfully")
    @APIResponse(responseCode = "400", description = "Invalid user ID or code")
    @APIResponse(responseCode = "500", description = "Internal server error")
    public Response validateTotp(@PathParam("user_id") final String userid, Map<String, String> data) {
        return khodeResourceService.validateTotp(userid, data);
    }

    @DELETE
    @Path("totp/{user_id}")
    @Produces(MediaType.APPLICATION_JSON)
    @APIResponse(
            responseCode = "200",
            description = "TOTP disabled successfully",
            content = {@Content(
                    schema = @Schema(
                            implementation = Response.class,
                            type = SchemaType.OBJECT
                    )
            )}
    )
    @APIResponse(
            responseCode = "400",
            description = "TOTP not enabled or invalid user ID"
    )
    @APIResponse(
            responseCode = "500",
            description = "Internal server error"
    )
    @Operation(
            summary = "Disable TOTP for user",
            description = "This endpoint disables TOTP for the user."
    )
    public Response disableTotp(@PathParam("user_id") final String userid) {
        return khodeResourceService.disableTotp(userid);
    }

    @POST
    @Path("totp/disable-with-validation/{user_id}")
    @Consumes(MediaType.APPLICATION_JSON)
    @Produces(MediaType.APPLICATION_JSON)
    @Operation(
            summary = "Disable TOTP with validation for user",
            description = "This endpoint validates TOTP before disabling it for the user"
    )
    @APIResponse(
            responseCode = "200",
            description = "TOTP disabled successfully",
            content = {@Content(
                    schema = @Schema(
                            implementation = Response.class,
                            type = SchemaType.OBJECT
                    )
            )}
    )
    @APIResponse(responseCode = "400", description = "TOTP not enabled, invalid code, or invalid user ID")
    @APIResponse(responseCode = "500", description = "Internal server error")
    public Response disableTotpWithValidation(@PathParam("user_id") final String userid, Map<String, String> data) {
        return khodeResourceService.disableTotpWithValidation(userid, data);
    }
}
