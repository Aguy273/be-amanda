const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Checking and creating missing roles...');
    const roles = ['ADMIN', 'MASTER', 'STAFF'];

    for (const roleName of roles) {
        const existing = await prisma.role.findUnique({
            where: { name: roleName }
        });

        if (!existing) {
            console.log(`Creating role: ${roleName}`);
            await prisma.role.create({
                data: { name: roleName }
            });
        } else {
            console.log(`Role exists: ${roleName}`);
        }
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
