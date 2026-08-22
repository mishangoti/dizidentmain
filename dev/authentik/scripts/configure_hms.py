from authentik.core.models import Group, Application
from authentik.providers.oauth2.models import (
    OAuth2Provider,
    ScopeMapping,
    RedirectURI,
    RedirectURIMatchingMode,
    ClientType,
    IssuerMode,
    SubModes,
)
from authentik.flows.models import Flow
from authentik.crypto.models import CertificateKeyPair

group_names = [
    "hms-superadmin",
    "hms-org",
    "hms-doctor",
    "hms-service-provider",
    "hms-patient",
]
for n in group_names:
    g, c = Group.objects.get_or_create(name=n)
    print(f"group {n} created={c} pk={g.pk}")

expr = """role = \"PATIENT\"
names = [g.name for g in request.user.groups.all()]
mapping = {
  \"hms-superadmin\": \"SUPERADMIN\",
  \"hms-org\": \"ORG\",
  \"hms-doctor\": \"DOCTOR\",
  \"hms-service-provider\": \"SERVICE_PROVIDER\",
  \"hms-patient\": \"PATIENT\",
}
for n, r in mapping.items():
  if n in names:
    role = r
    break
mobile = request.user.attributes.get(\"mobile\", request.user.username)
return {
  \"hms_role\": role,
  \"mobile\": mobile,
}
"""

sm, created = ScopeMapping.objects.update_or_create(
    name="HMS role and mobile claims",
    defaults={
        "scope_name": "hms",
        "description": "Emits hms_role and mobile for Clinic HMS",
        "expression": expr,
    },
)
print(f"scope_mapping created={created} pk={sm.pk}")

auth_flow = Flow.objects.get(slug="default-authentication-flow")
authz_flow = Flow.objects.get(slug="default-provider-authorization-implicit-consent")
inv_flow = Flow.objects.get(slug="default-provider-invalidation-flow")
signing = CertificateKeyPair.objects.first()

wanted = {"openid", "email", "profile", "offline_access", "hms"}
mappings = list(ScopeMapping.objects.filter(scope_name__in=wanted))
if sm not in mappings:
    mappings.append(sm)

client_id = "dizidental-hms-spa"
provider = OAuth2Provider.objects.filter(name="DiziDental HMS OIDC").first()
p_created = provider is None
if provider is None:
    provider = OAuth2Provider(
        name="DiziDental HMS OIDC",
        authorization_flow=authz_flow,
        authentication_flow=auth_flow,
        invalidation_flow=inv_flow,
        client_type=ClientType.PUBLIC,
        client_id=client_id,
        sub_mode=SubModes.USER_UUID,
        include_claims_in_id_token=True,
        issuer_mode=IssuerMode.PER_PROVIDER,
        access_code_validity="minutes=1",
        access_token_validity="minutes=60",
        refresh_token_validity="days=30",
        signing_key=signing,
        grant_types=["authorization_code", "refresh_token"],
    )
    provider.save()
else:
    provider.authorization_flow = authz_flow
    provider.authentication_flow = auth_flow
    provider.invalidation_flow = inv_flow
    provider.client_type = ClientType.PUBLIC
    provider.client_id = client_id
    provider.sub_mode = SubModes.USER_UUID
    provider.include_claims_in_id_token = True
    provider.issuer_mode = IssuerMode.PER_PROVIDER
    provider.access_code_validity = "minutes=1"
    provider.access_token_validity = "minutes=60"
    provider.refresh_token_validity = "days=30"
    provider.signing_key = signing
    provider.grant_types = ["authorization_code", "refresh_token"]
    provider.save()

provider.redirect_uris = [
    RedirectURI(matching_mode=RedirectURIMatchingMode.STRICT, url="http://localhost:5173/auth/callback"),
    RedirectURI(matching_mode=RedirectURIMatchingMode.STRICT, url="http://127.0.0.1:5173/auth/callback"),
]
provider.save()
provider.property_mappings.set(mappings)
print(f"provider created={p_created} pk={provider.pk} client_id={provider.client_id}")

app, a_created = Application.objects.update_or_create(
    slug="dizidental-hms",
    defaults={
        "name": "DiziDental HMS",
        "provider": provider,
        "meta_launch_url": "http://localhost:5173/",
        "policy_engine_mode": "any",
    },
)
print(f"app created={a_created} slug={app.slug}")
print("ISSUER=http://localhost:9000/application/o/dizidental-hms/")
print("CLIENT_ID=" + client_id)
print("DONE")
