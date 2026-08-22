from authentik.providers.oauth2.models import ScopeMapping
sm = ScopeMapping.objects.filter(name="HMS role and mobile claims").first()
if not sm:
    print("mapping missing")
else:
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
    sm.expression = expr
    sm.save()
    print("updated scope mapping expression to use groups")