FROM quay.io/keycloak/keycloak:26.2.2 AS builder

USER root
ENV KC_DB=postgres

ADD --chown=keycloak:keycloak --chmod=644 ./providers/*.jar /opt/keycloak/providers/
RUN touch -m --date=@1743465600 /opt/keycloak/providers/*

USER keycloak
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.2.2

COPY --from=builder /opt/keycloak/ /opt/keycloak/

ENTRYPOINT ["/opt/keycloak/bin/kc.sh", "start", "--optimized"]