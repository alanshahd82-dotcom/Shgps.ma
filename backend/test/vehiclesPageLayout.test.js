/**
 * Vehicles Page Layout Tests
 * Verifies the CSS/component fix for the broken Vehicles page layout.
 * Root cause: src/index.css was accidentally replaced with only the 49-line
 * athar-live-speed block, removing Tailwind directives and all ath-* styles.
 */

const fs = require('fs');
const path = require('path');

function readFile(filePath) {
  try {
    return fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf8');
  } catch {
    return '';
  }
}

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, pass: true }); }
  catch (e) { results.push({ name, pass: false, error: e.message }); }
}
function ok(v, m) { if (!v) throw new Error(m || 'fail'); }
function eq(a, b) { if (a !== b) throw new Error('Expected ' + b + ', got ' + a); }

const css = readFile('src/index.css');
const deviceList = readFile('src/pages/client/DeviceList.jsx');
const vehicleCard = readFile('src/components/VehicleCard.jsx');

// === Root cause: CSS restore ===
test('CSS-1: Tailwind directives present', () => {
  ok(css.includes('@tailwind base'), 'missing @tailwind base');
  ok(css.includes('@tailwind components'), 'missing @tailwind components');
  ok(css.includes('@tailwind utilities'), 'missing @tailwind utilities');
});

test('CSS-2: design-system tokens import present', () => {
  ok(css.includes("@import './design-system/tokens.css'"), 'missing tokens import');
});

test('CSS-3: ath-card class defined', () => {
  ok(css.includes('.ath-card'), 'missing .ath-card class');
});

test('CSS-4: ath-* CSS variables defined', () => {
  ok(css.includes('--ath-txt'), 'missing --ath-txt');
  ok(css.includes('--ath-bg'), 'missing --ath-bg');
  ok(css.includes('--ath-mut'), 'missing --ath-mut');
  ok(css.includes('--ath-line'), 'missing --ath-line');
  ok(css.includes('--ath-bg2'), 'missing --ath-bg2');
  ok(css.includes('--ath-disp'), 'missing --ath-disp');
  ok(css.includes('--ath-green2'), 'missing --ath-green2');
});

test('CSS-5: live-dot animation defined', () => {
  ok(css.includes('live-dot'), 'missing live-dot');
});

// === DeviceCard layout (Vehicles page) ===
test('UI-1: DeviceCard uses flex layout (not concatenated)', () => {
  ok(deviceList.includes('className="flex w-full items-start gap-3 p-4'), 'DeviceCard button not flex');
});

test('UI-2: DeviceCard has gap spacing', () => {
  ok(deviceList.includes('gap-3'), 'no gap-3');
  ok(deviceList.includes('gap-2'), 'no gap-2');
  ok(deviceList.includes('gap-1.5'), 'no gap-1.5');
});

test('UI-3: DeviceList main has max-w-xl (viewport constraint)', () => {
  ok(deviceList.includes('max-w-xl'), 'no max-w-xl');
});

test('UI-4: DeviceCard has no fixed oversized widths', () => {
  const cardSection = deviceList.substring(deviceList.indexOf('function DeviceCard'), deviceList.indexOf('export default'));
  ok(!cardSection.includes('w-[500'), 'fixed w-[500]');
  ok(!cardSection.includes('w-[600'), 'fixed w-[600]');
  ok(!cardSection.includes('w-[1024'), 'fixed w-[1024]');
});

test('UI-5: DeviceCard uses ath-card class', () => {
  ok(deviceList.includes('ath-card'), 'no ath-card class');
});

test('UI-6: DeviceCard text uses truncate (no overflow)', () => {
  ok(deviceList.includes('truncate'), 'no truncate');
  ok(deviceList.includes('min-w-0'), 'no min-w-0');
});

test('UI-7: DeviceList filter bar uses overflow-x-auto (not page overflow)', () => {
  ok(deviceList.includes('overflow-x-auto'), 'no overflow-x-auto on filter bar');
  ok(deviceList.includes('shrink-0'), 'filter buttons not shrink-0');
});

// === VehicleCard image (Home page) ===
test('IMG-1: image uses object-contain (no stretch)', () => {
  ok(vehicleCard.includes('object-contain'), 'no object-contain');
});

test('IMG-2: image has maxHeight constraint', () => {
  ok(vehicleCard.includes('maxHeight'), 'no maxHeight');
});

test('IMG-3: image container has max-w and shrink-0', () => {
  ok(vehicleCard.includes('max-w-[170px]'), 'no max-w on container');
  ok(vehicleCard.includes('shrink-0'), 'no shrink-0 on container');
});

test('IMG-4: image container width is percentage (responsive)', () => {
  ok(vehicleCard.includes('w-[42%]'), 'no w-[42%] responsive width');
});

// === Telemetry unchanged ===
test('TEL-1: status logic unchanged', () => {
  ok(deviceList.includes("device.status === 'online'"), 'status check changed');
  ok(deviceList.includes('statusKey'), 'statusKey removed');
});

test('TEL-2: speed logic unchanged', () => {
  ok(deviceList.includes('Number(device.speed)'), 'speed logic changed');
  ok(deviceList.includes('Math.round(speed)'), 'speed display changed');
});

test('TEL-3: voltage logic unchanged', () => {
  ok(deviceList.includes('formatVoltage'), 'formatVoltage removed');
  ok(deviceList.includes('getVoltageColor'), 'getVoltageColor removed');
});

test('TEL-4: battery/charge logic unchanged', () => {
  ok(deviceList.includes('powerDisconnected'), 'powerDisconnected removed');
});

test('TEL-5: signal logic unchanged', () => {
  ok(vehicleCard.includes('signalToBars'), 'signalToBars removed');
  ok(vehicleCard.includes('SignalBars'), 'SignalBars removed');
});

test('TEL-6: no engine commands in layout fix', () => {
  ok(!css.includes('engineStop'), 'engineStop in CSS');
  ok(!css.includes('engineResume'), 'engineResume in CSS');
});

// === Responsive: mobile portrait / landscape / desktop ===
test('RESP-1: mobile portrait (max-w-xl fits 375px)', () => {
  ok(deviceList.includes('max-w-xl'), 'no max-w-xl for mobile');
  ok(deviceList.includes('mx-auto'), 'no mx-auto centering');
});

test('RESP-2: cards use w-full (fill container)', () => {
  ok(deviceList.includes('w-full'), 'no w-full on cards');
});

test('RESP-3: no horizontal overflow from cards', () => {
  ok(deviceList.includes('overflow-hidden'), 'no overflow-hidden on cards');
});

// === Vehicle types ===
test('TYPE-1: car type supported', () => {
  ok(vehicleCard.includes('car: carArt'), 'no car art');
});

test('TYPE-2: bike/motorcycle type supported', () => {
  ok(vehicleCard.includes('bike: bikeArt'), 'no bike art');
});

test('TYPE-3: truck type supported', () => {
  ok(vehicleCard.includes('truck: truckArt'), 'no truck art');
});

const passed = results.filter(r => r.pass).length;
const failed = results.filter(r => !r.pass);
console.log('\n=== Vehicles Page Layout Tests ===');
console.log('Total: ' + results.length + ', Passed: ' + passed + ', Failed: ' + failed.length);
if (failed.length > 0) {
  console.log('\nFailures:');
  failed.forEach(f => console.log('  ✗ ' + f.name + ': ' + f.error));
}
console.log('=== End ===\n');

module.exports = { results, passed, failed: failed.length };
