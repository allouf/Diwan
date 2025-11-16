import { PrismaClient, UserRole, Priority, SenderType, DocumentStatus, OutcomeType } from '../src/generated/prisma';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing data (for development only)
  console.log('🧹 Cleaning existing data...');
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.documentSeenEntry.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.outcome.deleteMany();
  await prisma.documentDepartment.deleteMany();
  await prisma.document.deleteMany();
  await prisma.categoryDepartment.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  await prisma.department.deleteMany();
  await prisma.systemConfig.deleteMany();

  // Create system configuration
  console.log('⚙️ Creating system configuration...');
  await prisma.systemConfig.createMany({
    data: [
      {
        key: 'SYSTEM_NAME',
        value: 'Correspondence Management System',
        description: 'Name of the CMS system',
      },
      {
        key: 'SYSTEM_NAME_AR',
        value: 'نظام إدارة المراسلات',
        description: 'Arabic name of the CMS system',
      },
      {
        key: 'ORGANIZATION',
        value: 'HIAST',
        description: 'Organization code',
      },
      {
        key: 'ORGANIZATION_FULL',
        value: 'Higher Institute for Applied Science and Technology',
        description: 'Full organization name',
      },
      {
        key: 'ORGANIZATION_FULL_AR',
        value: 'المعهد العالي للعلوم التطبيقية والتكنولوجيا',
        description: 'Full organization name in Arabic',
      },
      {
        key: 'REF_NUMBER_SEQUENCE',
        value: '1',
        description: 'Current sequence number for reference generation',
      },
    ],
  });

  // Create departments
  console.log('🏢 Creating departments...');
  await prisma.department.createMany({
    data: [
      {
        name: 'Information Technology',
        code: 'IT',
        nameAr: 'تكنولوجيا المعلومات',
        contactPerson: 'Ahmad Al-Rashid',
        email: 'it@hiast.edu.sy',
        phone: '+963-11-6112000',
        description: 'Handles all IT infrastructure and software development',
      },
      {
        name: 'Human Resources',
        code: 'HR',
        nameAr: 'الموارد البشرية',
        contactPerson: 'Layla Hassan',
        email: 'hr@hiast.edu.sy',
        phone: '+963-11-6112001',
        description: 'Manages employee relations and administrative affairs',
      },
      {
        name: 'Finance & Accounting',
        code: 'FIN',
        nameAr: 'المالية والمحاسبة',
        contactPerson: 'Omar Khalil',
        email: 'finance@hiast.edu.sy',
        phone: '+963-11-6112002',
        description: 'Financial planning, budgeting, and accounting',
      },
      {
        name: 'Academic Affairs',
        code: 'ACA',
        nameAr: 'الشؤون الأكاديمية',
        contactPerson: 'Dr. Mariam Farid',
        email: 'academic@hiast.edu.sy',
        phone: '+963-11-6112003',
        description: 'Academic programs and student affairs',
      },
      {
        name: 'Research & Development',
        code: 'RND',
        nameAr: 'البحث والتطوير',
        contactPerson: 'Dr. Samir Nouri',
        email: 'research@hiast.edu.sy',
        phone: '+963-11-6112004',
        description: 'Research projects and innovation initiatives',
      },
      {
        name: 'Legal Affairs',
        code: 'LEG',
        nameAr: 'الشؤون القانونية',
        contactPerson: 'Nadia Al-Zahra',
        email: 'legal@hiast.edu.sy',
        phone: '+963-11-6112005',
        description: 'Legal consultation and contract management',
      },
      {
        name: 'Correspondence Office',
        code: 'COR',
        nameAr: 'مكتب المراسلات',
        contactPerson: 'Fatima Al-Sakr',
        email: 'correspondence@hiast.edu.sy',
        phone: '+963-11-6112006',
        description: 'Central correspondence management and document routing',
      },
    ],
  });

  // Get created departments for references
  const createdDepartments = await prisma.department.findMany();
  const itDept = createdDepartments.find(d => d.code === 'IT')!;
  const hrDept = createdDepartments.find(d => d.code === 'HR')!;
  const financeDept = createdDepartments.find(d => d.code === 'FIN')!;
  const academicDept = createdDepartments.find(d => d.code === 'ACA')!;
  const researchDept = createdDepartments.find(d => d.code === 'RND')!;
  const legalDept = createdDepartments.find(d => d.code === 'LEG')!;
  const correspondenceDept = createdDepartments.find(d => d.code === 'COR')!;

  // Create categories
  console.log('📂 Creating categories...');
  await prisma.category.createMany({
    data: [
      { name: 'Administrative', nameAr: 'إدارية' },
      { name: 'Financial', nameAr: 'مالية' },
      { name: 'Academic', nameAr: 'أكاديمية' },
      { name: 'Technical', nameAr: 'تقنية' },
      { name: 'Legal', nameAr: 'قانونية' },
      { name: 'Research', nameAr: 'بحثية' },
      { name: 'Student Affairs', nameAr: 'شؤون الطلاب' },
      { name: 'External Relations', nameAr: 'علاقات خارجية' },
      { name: 'Procurement', nameAr: 'مشتريات' },
      { name: 'Infrastructure', nameAr: 'بنية تحتية' },
    ],
  });

  // Get created categories for relationships
  const createdCategories = await prisma.category.findMany();
  const adminCategory = createdCategories.find(c => c.name === 'Administrative')!;
  const financialCategory = createdCategories.find(c => c.name === 'Financial')!;
  const academicCategory = createdCategories.find(c => c.name === 'Academic')!;
  const technicalCategory = createdCategories.find(c => c.name === 'Technical')!;
  const legalCategory = createdCategories.find(c => c.name === 'Legal')!;
  const researchCategory = createdCategories.find(c => c.name === 'Research')!;

  // Create category-department relationships
  console.log('🔗 Creating category-department relationships...');
  await prisma.categoryDepartment.createMany({
    data: [
      // Administrative -> HR, Correspondence
      { categoryId: adminCategory.id, departmentId: hrDept.id },
      { categoryId: adminCategory.id, departmentId: correspondenceDept.id },

      // Financial -> Finance
      { categoryId: financialCategory.id, departmentId: financeDept.id },

      // Academic -> Academic Affairs
      { categoryId: academicCategory.id, departmentId: academicDept.id },

      // Technical -> IT
      { categoryId: technicalCategory.id, departmentId: itDept.id },

      // Legal -> Legal Affairs
      { categoryId: legalCategory.id, departmentId: legalDept.id },

      // Research -> Research & Development
      { categoryId: researchCategory.id, departmentId: researchDept.id },
    ],
  });

  // Create users
  console.log('👥 Creating users...');
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const defaultPassword = await bcrypt.hash('password123', 10);

  await prisma.user.createMany({
    data: [
      // System Admin
      {
        name: 'Admin',
        fullName: 'System Administrator',
        email: 'admin@hiast.edu.sy',
        password: hashedPassword,
        role: UserRole.ADMIN,
      },
      // Correspondence Officer
      {
        name: 'Fatima',
        fullName: 'Fatima Al-Sakr',
        email: 'fatima.sakr@hiast.edu.sy',
        password: defaultPassword,
        role: UserRole.CORRESPONDENCE_OFFICER,
        departmentId: correspondenceDept.id,
      },
      // Department Heads
      {
        name: 'Ahmad',
        fullName: 'Ahmad Al-Rashid',
        email: 'ahmad.rashid@hiast.edu.sy',
        password: defaultPassword,
        role: UserRole.DEPARTMENT_HEAD,
        departmentId: itDept.id,
      },
      {
        name: 'Layla',
        fullName: 'Layla Hassan',
        email: 'layla.hassan@hiast.edu.sy',
        password: defaultPassword,
        role: UserRole.DEPARTMENT_HEAD,
        departmentId: hrDept.id,
      },
      {
        name: 'Omar',
        fullName: 'Omar Khalil',
        email: 'omar.khalil@hiast.edu.sy',
        password: defaultPassword,
        role: UserRole.DEPARTMENT_HEAD,
        departmentId: financeDept.id,
      },
      // Department Users
      {
        name: 'Sarah',
        fullName: 'Sarah Al-Nouri',
        email: 'sarah.nouri@hiast.edu.sy',
        password: defaultPassword,
        role: UserRole.DEPARTMENT_USER,
        departmentId: itDept.id,
      },
      {
        name: 'Khalid',
        fullName: 'Khalid Mahmoud',
        email: 'khalid.mahmoud@hiast.edu.sy',
        password: defaultPassword,
        role: UserRole.DEPARTMENT_USER,
        departmentId: hrDept.id,
      },
      {
        name: 'Rania',
        fullName: 'Rania Farid',
        email: 'rania.farid@hiast.edu.sy',
        password: defaultPassword,
        role: UserRole.DEPARTMENT_USER,
        departmentId: academicDept.id,
      },
    ],
  });

  // Get created users
  const createdUsers = await prisma.user.findMany();
  const adminUser = createdUsers.find(u => u.role === UserRole.ADMIN)!;
  const correspondenceOfficer = createdUsers.find(u => u.role === UserRole.CORRESPONDENCE_OFFICER)!;
  const itHead = createdUsers.find(u => u.fullName === 'Ahmad Al-Rashid')!;

  // Create sample documents
  console.log('📄 Creating sample documents...');
  const year = new Date().getFullYear();

  const sampleDocs = [
    {
      referenceNumber: `HIAST-${year}-00001`,
      subject: 'Budget Approval Request for IT Infrastructure',
      summary: 'Request for approval of annual IT infrastructure budget including hardware upgrades, software licenses, and network improvements.',
      senderName: 'Ministry of Higher Education',
      category: financialCategory,
      departments: [financeDept, itDept],
      priority: Priority.HIGH,
      status: DocumentStatus.COMPLETED,
    },
    {
      referenceNumber: `HIAST-${year}-00002`,
      subject: 'New Faculty Recruitment Guidelines',
      summary: 'Updated guidelines for recruiting new faculty members including qualification requirements and interview processes.',
      senderName: 'Academic Council',
      category: academicCategory,
      departments: [hrDept, academicDept],
      priority: Priority.NORMAL,
      status: DocumentStatus.COMPLETED,
    },
    {
      referenceNumber: `HIAST-${year}-00003`,
      subject: 'Research Collaboration Proposal with Damascus University',
      summary: 'Proposal for joint research projects in the field of renewable energy and sustainable technology.',
      senderName: 'Damascus University Research Office',
      category: researchCategory,
      departments: [researchDept, academicDept],
      priority: Priority.HIGH,
      status: DocumentStatus.IN_PROGRESS,
    },
    {
      referenceNumber: `HIAST-${year}-00004`,
      subject: 'Legal Review of New Student Admission Policies',
      summary: 'Legal compliance review for updated student admission and enrollment policies.',
      senderName: 'Legal Affairs Department',
      category: legalCategory,
      departments: [legalDept, academicDept],
      priority: Priority.NORMAL,
      status: DocumentStatus.IN_PROGRESS,
    },
    {
      referenceNumber: `HIAST-${year}-00005`,
      subject: 'IT Security Audit Requirements',
      summary: 'Annual IT security audit requirements and compliance checklist for all systems.',
      senderName: 'National Cybersecurity Directorate',
      category: technicalCategory,
      departments: [itDept],
      priority: Priority.URGENT,
      status: DocumentStatus.PENDING,
    },
  ];

  const documents = [];
  for (const doc of sampleDocs) {
    const createdDoc = await prisma.document.create({
      data: {
        referenceNumber: doc.referenceNumber,
        dateReceived: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        subject: doc.subject,
        summary: doc.summary,
        senderType: SenderType.EXTERNAL,
        senderName: doc.senderName,
        status: doc.status,
        priority: doc.priority,
        categoryId: doc.category.id,
        createdById: correspondenceOfficer.id,
      },
    });

    // Assign to departments
    for (const dept of doc.departments) {
      await prisma.documentDepartment.create({
        data: {
          documentId: createdDoc.id,
          departmentId: dept.id,
        },
      });
    }

    documents.push(createdDoc);
  }

  // Create some outcomes for completed documents
  console.log('📋 Creating sample outcomes...');
  const completedDocs = documents.filter(d => d.status === DocumentStatus.COMPLETED);

  for (const doc of completedDocs) {
    await prisma.outcome.create({
      data: {
        type: OutcomeType.APPROVED,
        summary: `Document ${doc.referenceNumber} has been reviewed and approved. All requirements have been met and actions have been taken.`,
        date: new Date(),
        documentId: doc.id,
        departmentId: itDept.id,
        loggedById: itHead.id,
        requiresFollowUp: false,
      },
    });
  }

  // Create some activity logs
  console.log('📊 Creating activity logs...');
  for (let i = 0; i < 20; i++) {
    const randomDoc = documents[Math.floor(Math.random() * documents.length)];
    await prisma.activityLog.create({
      data: {
        action: 'Document Created',
        actionAr: 'تم إنشاء الوثيقة',
        details: `Document with reference number ${randomDoc.referenceNumber} created and assigned to departments`,
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        userId: correspondenceOfficer.id,
        documentId: randomDoc.id,
      },
    });
  }

  console.log('✅ Database seeding completed successfully!');
  console.log('');
  console.log('🔑 Default Login Credentials:');
  console.log('   Admin: admin@hiast.edu.sy / admin123');
  console.log('   Correspondence Officer: fatima.sakr@hiast.edu.sy / password123');
  console.log('   IT Head: ahmad.rashid@hiast.edu.sy / password123');
  console.log('   HR Head: layla.hassan@hiast.edu.sy / password123');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
