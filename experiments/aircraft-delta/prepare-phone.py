"""Make an isolated development app. Never edit the regular app's files/configuration."""
from pathlib import Path
import hashlib, json, os, plistlib, secrets, shutil, subprocess

root = Path.cwd()
output = root / '.local/oos-test-phone'
project = output / 'project'
if project.exists():
    raise SystemExit('Isolated project already exists; preserve it and inspect before preparing another build.')
output.mkdir(parents=True, exist_ok=True)
host = subprocess.check_output(['ipconfig', 'getifaddr', 'en0'], text=True).strip()
config = {'host': host, 'port': 8787, 'key': secrets.token_urlsafe(24)}
(output / 'server-config.json').write_text(json.dumps(config, indent=2))
os.chmod(output / 'server-config.json', 0o600)
bundle = 'live.outofsight.app.localtest'
url = f'http://{host}:8787'
protected = [root / 'mobile/backend.json', root / 'mobile/ios/App/App.xcodeproj/project.pbxproj', root / 'mobile/ios/App/App/Info.plist', root / 'lib/live-data-client.ts']
(output / 'original-file-hashes.json').write_text(json.dumps({str(p): hashlib.sha256(p.read_bytes()).hexdigest() for p in protected}, indent=2))
for name in ['app', 'components', 'lib', 'public', 'content', 'data', 'experiments']:
    shutil.copytree(root / name, project / name)
for name in ['package.json', 'tsconfig.json', 'tailwind.config.ts', 'next-env.d.ts']:
    if (root / name).exists(): shutil.copy2(root / name, project / name)
(project / 'node_modules').symlink_to(root / 'node_modules', target_is_directory=True)
mobile = project / 'mobile'
mobile.mkdir()
for name in ['frontend', 'scripts']:
    shutil.copytree(root / 'mobile' / name, mobile / name)
for name in ['vite.config.ts', 'postcss.config.cjs', 'package.json', 'tsconfig.json']:
    shutil.copy2(root / 'mobile' / name, mobile / name)
(mobile / 'node_modules').symlink_to(root / 'mobile/node_modules', target_is_directory=True)
(mobile / 'backend.json').write_text(json.dumps({'url': url, 'publishableKey': config['key']}))
native = mobile / 'ios/App'
for name in ['App', 'App.xcodeproj', 'CapApp-SPM', 'Shared', 'LiveTrackingWidget']:
    shutil.copytree(root / 'mobile/ios/App' / name, native / name)
for config_file in (root / 'mobile/ios').glob('*.xcconfig'):
    shutil.copy2(config_file, mobile / 'ios' / config_file.name)

# All aircraft screens now consume the tested v3 assembler through the local socket.
(project / 'lib/live-data-client.ts').write_text('export { subscribeLiveState } from "../experiments/aircraft-delta/phone-client";\n')
network = mobile / 'frontend/network.ts'
text = network.read_text()
text = '\n'.join(line for line in text.splitlines() if 'local.pathname === "/api/police"' not in line) + '\n'
network.write_text(text)
app = mobile / 'frontend/App.tsx'
text = app.read_text()
text = 'import { PhoneBanner } from "../../experiments/aircraft-delta/PhoneBanner";\n' + text
text = text.replace('<AircraftAlertPreferenceSync />', '').replace('<LiveTrackingPreferenceSync />', '')
text = text.replace('<SiteHeader />', '<PhoneBanner /><SiteHeader />')
text = text.replace('if (pathname === "/settings/alerts") return <Alerts />;', 'if (pathname === "/settings/alerts") return <main style={{padding:32}}>Alerts are disabled in OOS Test.</main>;')
app.write_text(text)

# The native build has separate identity, local storage and URL scheme, and no extension.
pbx = native / 'App.xcodeproj/project.pbxproj'
data = json.loads(subprocess.check_output(['plutil', '-convert', 'json', '-o', '-', str(pbx)]))
objects = data['objects']
app_target = next(k for k,v in objects.items() if v.get('isa') == 'PBXNativeTarget' and v.get('name') == 'App')
widget_target = next(k for k,v in objects.items() if v.get('isa') == 'PBXNativeTarget' and v.get('name') == 'LiveTrackingWidget')
objects[app_target]['dependencies'] = []
objects[app_target]['buildPhases'] = [p for p in objects[app_target]['buildPhases'] if objects[p].get('isa') != 'PBXCopyFilesBuildPhase']
objects[data['rootObject']]['targets'] = [app_target]
objects[data['rootObject']]['attributes']['TargetAttributes'][app_target]['SystemCapabilities'] = {}
for entry in objects.values():
    settings = entry.get('buildSettings', {})
    if settings.get('PRODUCT_BUNDLE_IDENTIFIER') == 'live.outofsight.app':
        settings.update(PRODUCT_BUNDLE_IDENTIFIER=bundle, CURRENT_PROJECT_VERSION='1', MARKETING_VERSION='1.0.2', PRODUCT_NAME='OOS Test')
pbx.write_bytes(plistlib.dumps(data, fmt=plistlib.FMT_XML))
info = native / 'App/Info.plist'
data = plistlib.loads(info.read_bytes())
data['CFBundleDisplayName'] = 'OOS Test'
data['CFBundleURLTypes'] = [{'CFBundleURLName': bundle, 'CFBundleURLSchemes':['oos-test']}]
data['NSLocalNetworkUsageDescription'] = 'OOS Test connects to recorded aircraft data on your Mac for private testing.'
data['NSAppTransportSecurity'] = {'NSAllowsArbitraryLoads': True, 'NSAllowsLocalNetworking': True}
data['NSSupportsLiveActivities'] = False
info.write_bytes(plistlib.dumps(data))
(native / 'App/App.entitlements').write_bytes(plistlib.dumps({}))
(native / 'App/Configuration/GoogleService-Info.plist').unlink(missing_ok=True)
for p in native.rglob('*.swift'):
    text = p.read_text().replace('group.live.outofsight.app', 'group.live.outofsight.app.localtest')
    if p.name == 'SceneDelegate.swift': text = text.replace('url.scheme == "oos"', 'url.scheme == "oos-test"')
    if p.name == 'AppDelegate.swift': text = text.replace('if #available(iOS 16.2, *) { LiveTrackingSession.shared.recoverExistingActivity() }', '// Test builds do not restore production live activities.')
    p.write_text(text)
backend = native / 'Shared/AppBackend.swift'
text = backend.read_text()
import re
text = re.sub(r'static let baseURL = ".*"', 'static let baseURL = ' + json.dumps(url), text)
text = re.sub(r'static let publishableKey = ".*"', 'static let publishableKey = ' + json.dumps(config['key']), text)
backend.write_text(text)
capacitor = native / 'App/capacitor.config.json'
data = json.loads(capacitor.read_text())
data.update(appId=bundle, appName='OOS Test')
data['server']['cleartext'] = True
capacitor.write_text(json.dumps(data, indent=2))
(output / 'build-config.json').write_text(json.dumps({'project':str(project),'bundleId':bundle,'name':'OOS Test','feedURL':url,'sourceBuild':'144','testBuild':'1'}, indent=2))
print(f'Prepared isolated OOS Test project at {project}')
