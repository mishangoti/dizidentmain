from authentik.providers.oauth2.models import OAuth2Provider, SubModes, ScopeMapping
p = OAuth2Provider.objects.get(client_id="dizidental-hms-spa")
print("sub_mode", p.sub_mode)
print("SubModes", list(SubModes))
print("grant_types", p.grant_types)
sms = ScopeMapping.objects.filter(provider=p)
print("scopes", [(s.scope_name, s.name) for s in sms])