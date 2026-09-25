const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'a3f8c2e1d94b7065f21a8c3d6e0b4f9712a5c8d3e6f09b2c47a1e8d5f3b6c091';
const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('--- Starting Pincode End-to-End Verification ---');
  const prisma = new PrismaClient();

  try {
    // 1. Fetch a Staff user and two Distributor users
    const staffUser = await prisma.user.findFirst({
      where: { role: { in: ['STAFF', 'ADMIN', 'MANAGER'] }, isActive: true },
      select: { id: true, email: true, phone: true, role: true },
    });
    if (!staffUser) throw new Error('No active Staff/Admin user found');

    const distributors = await prisma.user.findMany({
      where: { role: 'DISTRIBUTOR', isActive: true },
      take: 2,
      select: { id: true, email: true, phone: true, role: true },
    });
    if (distributors.length < 2) throw new Error('Need at least 2 active distributors to test isolation');
    const distA = distributors[0];
    const distB = distributors[1];

    console.log(`Staff User: ${staffUser.id} (${staffUser.role})`);
    console.log(`Distributor A: ${distA.id}`);
    console.log(`Distributor B: ${distB.id}`);

    const staffToken = jwt.sign({ sub: staffUser.id, role: staffUser.role, email: staffUser.email, phone: staffUser.phone }, JWT_SECRET, { expiresIn: '1h' });
    const distAToken = jwt.sign({ sub: distA.id, role: distA.role, email: distA.email, phone: distA.phone }, JWT_SECRET, { expiresIn: '1h' });
    const distBToken = jwt.sign({ sub: distB.id, role: distB.role, email: distB.email, phone: distB.phone }, JWT_SECRET, { expiresIn: '1h' });

    // 2. Validate backend rejects missing or invalid pincode on driver creation
    console.log('\n[Test 1] Testing validation: missing pincode via Staff API...');
    let res = await fetch(`${BASE_URL}/staff/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        distributorId: distA.id,
        name: 'Invalid Pincode Driver',
        phone: '9876500001',
        vehicleType: '2 Wheeler',
        vehicleNumber: 'KL07AB0001',
      }),
    });
    console.log(`Response status for missing pincode: ${res.status}`);
    if (res.status !== 400) throw new Error(`Expected 400 for missing pincode, got ${res.status}`);
    const errBody = await res.json();
    console.log(`Validation error message:`, errBody.message);

    console.log('\n[Test 2] Testing validation: invalid 5-digit pincode...');
    res = await fetch(`${BASE_URL}/staff/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        distributorId: distA.id,
        name: 'Invalid Pincode Driver',
        phone: '9876500001',
        pincode: '12345',
        vehicleType: '2 Wheeler',
        vehicleNumber: 'KL07AB0001',
      }),
    });
    console.log(`Response status for 5-digit pincode: ${res.status}`);
    if (res.status !== 400) throw new Error(`Expected 400 for 5-digit pincode, got ${res.status}`);

    console.log('\n[Test 3] Testing validation: non-numeric pincode "ABC123"...');
    res = await fetch(`${BASE_URL}/staff/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        distributorId: distA.id,
        name: 'Invalid Pincode Driver',
        phone: '9876500001',
        pincode: 'ABC123',
        vehicleType: '2 Wheeler',
        vehicleNumber: 'KL07AB0001',
      }),
    });
    console.log(`Response status for non-numeric pincode: ${res.status}`);
    if (res.status !== 400) throw new Error(`Expected 400 for non-numeric pincode, got ${res.status}`);

    // 3. Staff creates driver with valid 6-digit Pincode
    console.log('\n[Test 4] Staff creates driver with valid 6-digit pincode "682001"...');
    res = await fetch(`${BASE_URL}/staff/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        distributorId: distA.id,
        name: 'Staff Test Driver',
        phone: '9876500011',
        pincode: '682001',
        routeOrArea: 'Kochi Central',
        vehicleType: '2 Wheeler',
        vehicleNumber: 'KL07XX1111',
      }),
    });
    console.log(`Response status: ${res.status}`);
    if (res.status !== 201) {
      const err = await res.text();
      throw new Error(`Failed to create driver: ${err}`);
    }
    const staffDriver = await res.json();
    console.log(`Created driver: id=${staffDriver.id}, pincode=${staffDriver.pincode}`);
    if (staffDriver.pincode !== '682001') throw new Error(`Pincode mismatch: expected 682001, got ${staffDriver.pincode}`);

    // 4. Staff updates driver pincode to '682035'
    console.log('\n[Test 5] Staff updates driver pincode to "682035"...');
    res = await fetch(`${BASE_URL}/staff/drivers/${staffDriver.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({
        pincode: '682035',
        routeOrArea: 'Kaloor Zone',
      }),
    });
    console.log(`Update response status: ${res.status}`);
    if (res.status !== 200) throw new Error(`Failed to update driver: ${await res.text()}`);
    const updatedStaffDriver = await res.json();
    console.log(`Updated driver: pincode=${updatedStaffDriver.pincode}, route=${updatedStaffDriver.routeOrArea}`);
    if (updatedStaffDriver.pincode !== '682035') throw new Error(`Pincode mismatch: expected 682035, got ${updatedStaffDriver.pincode}`);

    // 5. Staff GET detail
    console.log('\n[Test 6] Staff gets driver detail...');
    res = await fetch(`${BASE_URL}/staff/drivers/${staffDriver.id}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    const staffDriverDetail = await res.json();
    console.log(`Staff Driver detail: id=${staffDriverDetail.id}, pincode=${staffDriverDetail.pincode}`);
    if (staffDriverDetail.pincode !== '682035') throw new Error('Staff detail did not return correct pincode');

    // 6. Distributor A creates their own driver with pincode '682002'
    console.log('\n[Test 7] Distributor A creates driver with pincode "682002"...');
    res = await fetch(`${BASE_URL}/drivers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${distAToken}` },
      body: JSON.stringify({
        name: 'Distributor A Driver',
        phone: '9876500022',
        pincode: '682002',
        routeOrArea: 'Fort Kochi',
        vehicleType: '3 Wheeler',
        vehicleNumber: 'KL07YY2222',
      }),
    });
    console.log(`Distributor create status: ${res.status}`);
    if (res.status !== 201) throw new Error(`Distributor create failed: ${await res.text()}`);
    const distADriver = await res.json();
    console.log(`Distributor A created driver: id=${distADriver.id}, distributorId=${distADriver.distributorId}, pincode=${distADriver.pincode}`);
    if (distADriver.distributorId !== distA.id) throw new Error('Driver distributorId does not match authenticated distributor');
    if (distADriver.pincode !== '682002') throw new Error('Distributor A driver pincode mismatch');

    // 7. Distributor A updates driver pincode
    console.log('\n[Test 8] Distributor A updates driver pincode to "682024"...');
    res = await fetch(`${BASE_URL}/drivers/${distADriver.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${distAToken}` },
      body: JSON.stringify({
        pincode: '682024',
      }),
    });
    console.log(`Distributor update status: ${res.status}`);
    if (res.status !== 200) throw new Error(`Distributor update failed: ${await res.text()}`);
    const updatedDistDriver = await res.json();
    console.log(`Distributor A updated driver: pincode=${updatedDistDriver.pincode}`);
    if (updatedDistDriver.pincode !== '682024') throw new Error('Pincode update failed for distributor');

    // 8. Distributor isolation: Distributor B attempts to access Distributor A's driver
    console.log('\n[Test 9] Distributor B attempts to access Distributor A driver...');
    res = await fetch(`${BASE_URL}/drivers/${distADriver.id}`, {
      headers: { Authorization: `Bearer ${distBToken}` },
    });
    console.log(`Distributor B access status: ${res.status}`);
    if (res.status !== 404 && res.status !== 403) throw new Error(`Expected 404 or 403, got ${res.status}`);

    console.log('\n[Test 10] Distributor B attempts to update Distributor A driver pincode...');
    res = await fetch(`${BASE_URL}/drivers/${distADriver.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${distBToken}` },
      body: JSON.stringify({
        pincode: '999999',
      }),
    });
    console.log(`Distributor B update status: ${res.status}`);
    if (res.status !== 404 && res.status !== 403) throw new Error(`Expected 404 or 403, got ${res.status}`);

    // Clean up test drivers
    console.log('\n[Cleanup] Removing test drivers from database...');
    await prisma.driver.deleteMany({
      where: { id: { in: [staffDriver.id, distADriver.id] } },
    });
    console.log('Cleanup completed successfully.');

    console.log('\n=== ALL 10 TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
