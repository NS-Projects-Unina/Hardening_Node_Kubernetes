## Inizializzazione di Vault

### Avvio del terminale su Vault
```bash
kubectl exec -it vault-0 -n vault -- bin/sh
```

### Inizializzo Vault per ottenere le keys e il token root
```bash
vault operator init
```

### Faccio l'unseal di Vault per attivarlo (inserire le chiavi quando richieste)
```bash
vault operator unseal
```

### Faccio il login (inserire il token quando richiesto)
```bash
vault login
```

### Nel caso in cui ci siano due repliche su due nodi eseguire il join sul secondo
```bash
vault operator raft join http://vault-0.vault-internal:8200
```

### Attivo il path per i segreti (kv-v2)
```bash
vault secrets enable -path=secret kv-v2
```

### Abilito l'autenticazione Kubernetes
```bash
vault auth enable kubernetes
```

### Configuro Vault per comunicare con l'API Kubernetes
```bash
vault write auth/kubernetes/config \
    kubernetes_host="https://$KUBERNETES_PORT_443_TCP_ADDR:443"
```

## Creazione dei segreti
```bash
vault kv put secret/<pathName> <key1>="<value1>" <key2>="<value2>"
```

## Creazione delle policy
```bash
vault policy write <policyName> - <<EOF
path "secret/data/<pathName>" {
  capabilities = ["read"]
}
EOF
```

## Creazione dei ruoli
```bash
vault write auth/kubernetes/role/<roleName> \
    bound_service_account_names=<serviceAccountName> \
    bound_service_account_namespaces=<namespaceName> \
    policies=<policyName> \
    ttl=20m
```
**NB:** il `namespaceName` deve essere quello dove si trovano i pod che utilizzano il Service Account.

## Scrittura di un SecretProviderClass

### Caso 1: Solo file dei segreti nel pod

#### File `spc-vault-<pathName>.yaml`
```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: <pathName>-secrets
spec:
  provider: vault
  parameters:
    vaultAddress: "http://vault.vault.svc.cluster.local:8200"
    roleName: "<roleName>"
    objects: |
      - objectName: "<secretFileName>"
        secretPath: "secret/data/<pathName>"
        secretKey: "<key1>"
```
**NB:**  
`<pathName>` è il nome dato nella creazione del segreto (`secret/<pathName>`).  
`<key1>` è la chiave del segreto.  
`<secretFileName>` sarà il nome del file con il valore del segreto.

### Applicazione dello SPC
```bash
kubectl apply --filename ./spc-vault-<pathName>.yaml
```

### Modifiche al deployment del pod
```yaml
spec:
  serviceAccountName: <serviceAccountName>
  volumes: 
    - name: secrets-store-inline
      csi:
        driver: secrets-store.csi.k8s.io
        readOnly: true
        volumeAttributes:
          secretProviderClass: "<pathName>-secrets"
  containers:
    - name: <containerName>
      volumeMounts:
        - name: secrets-store-inline
          mountPath: "/mnt/secrets-store"
          readOnly: true
```

### Verifica
```bash
kubectl exec webapp -- cat /mnt/secrets-store/<secretFileName>
```

## Caso 2: File + k8s Secrets come env

#### File `spc-vault-<pathName>.yaml`
```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: <pathName>-secrets
spec:
  provider: vault
  secretObjects:
  - data:
    - objectName: <secretFileName>
      key: <envName>
    secretName: <pathName>-k8s-secret
    type: Opaque
  parameters:
    vaultAddress: "http://vault.vault.svc.cluster.local:8200"
    roleName: "<roleName>"
    objects: |
      - objectName: "<secretFileName>"
        secretPath: "secret/data/<pathName>"
        secretKey: "<key1>"
```
**NB:**  
`<pathName>` è il nome dato nella creazione del segreto (`secret/<pathName>`).  
`<key1>` è la chiave del segreto.  
`<secretFileName>` sarà il file con il valore del segreto.  
`<envName>` è la variabile d’ambiente da usare nel pod.

### Applicazione dello SPC
```bash
kubectl apply --filename ./spc-vault-<pathName>.yaml
```

### Modifiche al deployment del pod
```yaml
spec:
  serviceAccountName: <serviceAccountName>
  volumes: 
    - name: secrets-store-inline
      csi:
        driver: secrets-store.csi.k8s.io
        readOnly: true
        volumeAttributes:
          secretProviderClass: "<pathName>-secrets"
  containers:
    - name: <containerName>
      volumeMounts:
        - name: secrets-store-inline
          mountPath: "/mnt/secrets-store"
          readOnly: true
      env:
        - name: <envName>
          valueFrom:
            secretKeyRef:
              name: <pathName>-k8s-secret
              key: <envName>
```

### Verifica
```bash
kubectl exec webapp -- cat /mnt/secrets-store/<secretFileName>
kubectl exec <pod> -- env | grep <envName>
```

## NB:  
Il CSI entra in gioco ogni volta che si avvia il pod ed effettua l'injection dei file.  
**Assicurati di riavviare il pod.**