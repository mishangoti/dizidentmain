from authentik.providers.oauth2.models import OAuth2Provider
p = OAuth2Provider.objects.get(client_id="dizidental-hms-spa")
print("grant_types_before", getattr(p, "grant_types", None))
# Find allowed choices
field = p._meta.get_field("grant_types") if "grant_types" in [f.name for f in p._meta.get_fields()] else None
print("field", field)
if hasattr(p, "grant_types"):
    try:
        from authentik.providers.oauth2.models import GrantTypes
        print("GrantTypes", list(GrantTypes))
    except Exception as e:
        print("no GrantTypes enum", e)
    # Common values for public SPA
    desired = ["authorization_code", "refresh_token"]
    p.grant_types = desired
    p.save()
    p.refresh_from_db()
    print("grant_types_after", p.grant_types)