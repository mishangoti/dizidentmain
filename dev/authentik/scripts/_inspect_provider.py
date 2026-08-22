from authentik.providers.oauth2.models import OAuth2Provider
from authentik.core.models import Application
p = OAuth2Provider.objects.filter(client_id="dizidental-hms-spa").first()
print("found", bool(p))
if p:
    print("name", p.name)
    print("client_type", p.client_type)
    print("redirect_uris", p.redirect_uris)
    print("authentication_flow", p.authentication_flow_id, p.authentication_flow)
    print("authorization_flow", p.authorization_flow_id, p.authorization_flow)
    print("invalidation_flow", p.invalidation_flow_id, p.invalidation_flow)
    print("signing_key", p.signing_key_id, bool(p.signing_key))
    print("mappings", list(p.property_mappings.values_list("name", "scope_name")))
    print("issuer_mode", p.issuer_mode)
    print("sub_mode", p.sub_mode)
apps = Application.objects.filter(slug="dizidental-hms")
for a in apps:
    print("app", a.slug, "provider_id", a.provider_id)