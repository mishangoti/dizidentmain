from authentik.providers.oauth2.models import OAuth2Provider, RedirectURI, RedirectURIMatchingMode, RedirectURIType
import inspect as insp
p = OAuth2Provider.objects.get(client_id="dizidental-hms-spa")
print("RedirectURIType", list(RedirectURIType))
print("RedirectURI fields", getattr(RedirectURI, "__annotations__", {}))
print("current", p.redirect_uris)
sig = insp.signature(RedirectURI.__init__) if hasattr(RedirectURI, "__init__") else None
print("init", sig)
# Check dataclass fields
print("dataclass", getattr(RedirectURI, "__dataclass_fields__", {}))