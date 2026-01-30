const { PrismaClient } = require('@prisma/client');
const { faker } = require('@faker-js/faker');
const hashPassword = require('../../src/utils/hashPassword');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Seeding database...');

    console.log('Seeding roles...');
    const roles = [
      { name: 'MASTER', description: 'Super administrator dengan akses penuh' },
      { name: 'ADMIN', description: 'Administrator yang dapat mengelola staff' },
      { name: 'STAFF', description: 'Staff helpdesk yang menangani laporan' },
    ];

    const roleRecords = {};
    for (const roleData of roles) {
      const role = await prisma.role.upsert({
        where: { name: roleData.name },
        update: { description: roleData.description },
        create: roleData,
      });
      roleRecords[roleData.name] = role;
    }
    console.log(`   - ${roles.length} roles created/updated`);

    console.log('Seeding permissions...');
    const permissions = [
      { name: 'users.read', description: 'View users', resource: 'users', action: 'read' },
      { name: 'users.create', description: 'Create users', resource: 'users', action: 'create' },
      { name: 'users.update', description: 'Update users', resource: 'users', action: 'update' },
      { name: 'users.delete', description: 'Delete users', resource: 'users', action: 'delete' },

      { name: 'reports.read', description: 'View reports', resource: 'reports', action: 'read' },
      { name: 'reports.create', description: 'Create reports', resource: 'reports', action: 'create' },
      { name: 'reports.update', description: 'Update reports', resource: 'reports', action: 'update' },
      { name: 'reports.delete', description: 'Delete reports', resource: 'reports', action: 'delete' },
      { name: 'reports.assign', description: 'Assign reports to staff', resource: 'reports', action: 'assign' },
      
      // FAQs permissions
      { name: 'faqs.read', description: 'View FAQs', resource: 'faqs', action: 'read' },
      { name: 'faqs.create', description: 'Create FAQs', resource: 'faqs', action: 'create' },
      { name: 'faqs.update', description: 'Update FAQs', resource: 'faqs', action: 'update' },
      { name: 'faqs.delete', description: 'Delete FAQs', resource: 'faqs', action: 'delete' },
      
      // Broadcasts permissions
      { name: 'broadcasts.read', description: 'View broadcasts', resource: 'broadcasts', action: 'read' },
      { name: 'broadcasts.create', description: 'Create broadcasts', resource: 'broadcasts', action: 'create' },
      { name: 'broadcasts.update', description: 'Update broadcasts', resource: 'broadcasts', action: 'update' },
      { name: 'broadcasts.delete', description: 'Delete broadcasts', resource: 'broadcasts', action: 'delete' },
      
      // Roles permissions
      { name: 'roles.read', description: 'View roles', resource: 'roles', action: 'read' },
      { name: 'roles.create', description: 'Create roles', resource: 'roles', action: 'create' },
      { name: 'roles.update', description: 'Update roles', resource: 'roles', action: 'update' },
      { name: 'roles.delete', description: 'Delete roles', resource: 'roles', action: 'delete' },
      

      // Chats permissions
      { name: 'chats.monitor', description: 'Monitor all chats', resource: 'chats', action: 'monitor' },
      
      // Permissions permissions
      { name: 'permissions.read', description: 'View permissions', resource: 'permissions', action: 'read' },
      { name: 'permissions.create', description: 'Create permissions', resource: 'permissions', action: 'create' },
      { name: 'permissions.update', description: 'Update permissions', resource: 'permissions', action: 'update' },
      { name: 'permissions.delete', description: 'Delete permissions', resource: 'permissions', action: 'delete' },
      
      // Issue Types permissions
      { name: 'issue-types.read', description: 'View issue types', resource: 'issue-types', action: 'read' },
      { name: 'issue-types.create', description: 'Create issue types', resource: 'issue-types', action: 'create' },
      { name: 'issue-types.update', description: 'Update issue types', resource: 'issue-types', action: 'update' },
      { name: 'issue-types.delete', description: 'Delete issue types', resource: 'issue-types', action: 'delete' },
    ];

    const permissionRecords = {};
    for (const permData of permissions) {
      const permission = await prisma.permission.upsert({
        where: { name: permData.name },
        update: permData,
        create: permData,
      });
      permissionRecords[permData.name] = permission;
    }
    console.log(`- ${permissions.length} permissions created/updated`);

    console.log('Seeding role-permission mappings...');
    
    const masterPermissions = Object.keys(permissionRecords);
    for (const permName of masterPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleRecords['MASTER'].id,
            permissionId: permissionRecords[permName].id,
          }
        },
        update: {},
        create: {
          roleId: roleRecords['MASTER'].id,
          permissionId: permissionRecords[permName].id,
        },
      });
    }
    console.log(`   - MASTER: ${masterPermissions.length} permissions assigned`);

    // ADMIN - Can manage staff and reports
    const adminPermissions = [
      'users.read', 'users.create', 'users.update', 'users.delete',
      'reports.read', 'reports.update', 'reports.assign', 'reports.delete',
      'faqs.read', 'faqs.create', 'faqs.update', 'faqs.delete',
      'broadcasts.read', 'broadcasts.create', 'broadcasts.update',
      'issue-types.read',
    ];
    for (const permName of adminPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleRecords['ADMIN'].id,
            permissionId: permissionRecords[permName].id,
          }
        },
        update: {},
        create: {
          roleId: roleRecords['ADMIN'].id,
          permissionId: permissionRecords[permName].id,
        },
      });
    }
    console.log(`- ADMIN: ${adminPermissions.length} permissions assigned`);

    const staffPermissions = [
      'reports.read', 'reports.update', 'reports.create',
      'faqs.read',
      'broadcasts.read',
      'issue-types.read', 'issue-types.create',
    ];
    for (const permName of staffPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleRecords['STAFF'].id,
            permissionId: permissionRecords[permName].id,
          }
        },
        update: {},
        create: {
          roleId: roleRecords['STAFF'].id,
          permissionId: permissionRecords[permName].id,
        },
      });
    }
    console.log(`- STAFF: ${staffPermissions.length} permissions assigned`);

    console.log('Seeding issue types...');
    const issueTypes = [
      { 
        name: 'Hardware', 
        description: 'Masalah terkait perangkat keras (komputer, printer, dll)',
        icon: 'computer',
        color: '#3B82F6'
      },
      { 
        name: 'Software', 
        description: 'Masalah terkait aplikasi dan software',
        icon: 'code',
        color: '#8B5CF6'
      },
      { 
        name: 'Network', 
        description: 'Masalah terkait jaringan dan koneksi internet',
        icon: 'wifi',
        color: '#10B981'
      },
      { 
        name: 'Account & Access', 
        description: 'Masalah terkait akun dan hak akses',
        icon: 'key',
        color: '#F59E0B'
      },
      { 
        name: 'Other', 
        description: 'Masalah lainnya',
        icon: 'help',
        color: '#6B7280'
      },
    ];

    for (const issueTypeData of issueTypes) {
      await prisma.issueType.upsert({
        where: { name: issueTypeData.name },
        update: issueTypeData,
        create: issueTypeData,
      });
    }
    console.log(`   - ${issueTypes.length} issue types created/updated`);

    // Seed default users
    const masterExists = await prisma.user.findFirst({
      where: { role: { name: 'MASTER' }, deletedAt: null }
    });

    if (!masterExists) {
      console.log('👤 Seeding default master...');
      await prisma.user.create({
        data: {
          name: 'Master Administrator',
          email: 'master@amanda.com',
          phone: faker.phone.number(),
          password: await hashPassword('password'),
          roleId: roleRecords['MASTER'].id,
          hireDate: faker.date.past({ years: 3 }),
        },
      });
      console.log('   - Master created');
    }

    const adminExists = await prisma.user.findFirst({
      where: { role: { name: 'ADMIN' }, deletedAt: null }
    });

    if (!adminExists) {
      console.log('👤 Seeding default admin...');
      await prisma.user.create({
        data: {
          name: 'Administrator',
          email: 'admin@amanda.com',
          phone: faker.phone.number(),
          password: await hashPassword('password'),
          roleId: roleRecords['ADMIN'].id,
          hireDate: faker.date.past({ years: 2 }),
        },
      });
      console.log('   - Admin created');
    }

    const staffExists = await prisma.user.findFirst({
      where: { role: { name: 'STAFF' }, deletedAt: null }
    });

    if (!staffExists) {
      console.log('👤 Seeding default staff...');
      await prisma.user.create({
        data: {
          name: 'Staff User',
          email: 'staff@amanda.com',
          phone: faker.phone.number(),
          password: await hashPassword('password'),
          roleId: roleRecords['STAFF'].id,
          hireDate: faker.date.past({ years: 1 }),
        },
      });
      console.log('   - Staff created');
    }

    // Summary
    const counts = {
      roles: await prisma.role.count(),
      permissions: await prisma.permission.count(),
      rolePermissions: await prisma.rolePermission.count(),
      issueTypes: await prisma.issueType.count(),
      users: await prisma.user.count(),
    };

    console.log('✅ Seeding completed successfully!');
    console.log('📈 Database summary:');
    console.log(`   - Roles: ${counts.roles}`);
    console.log(`   - Permissions: ${counts.permissions}`);
    console.log(`   - Role-Permissions: ${counts.rolePermissions}`);
    console.log(`   - Issue Types: ${counts.issueTypes}`);
    console.log(`   - Users: ${counts.users}`);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
