# HIAST Correspondence Management System (CMS)

A comprehensive correspondence management system built for the Higher Institute for Applied Science and Technology (HIAST).

## 🏗️ Project Architecture

This project consists of two main components:

### Backend (`/backend`)
- **Framework**: Node.js + Express.js + TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT-based with role-based access control
- **Real-time**: Socket.IO integration
- **File Storage**: Local file system with Sharp image processing

### Frontend (`/frontend`)
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS + Headless UI
- **State Management**: React Query + Context API
- **Routing**: React Router v6
- **UI Components**: Custom components with Lucide React icons

## 🚀 Features

### ✅ Completed Features

#### Backend (85% Complete)
- **Authentication System**: JWT tokens, role-based access control
- **Document Management**: CRUD operations, status workflow, automatic reference numbering
- **User Management**: Complete user administration with roles and departments
- **File Management**: Upload system with image processing and security validation
- **API Endpoints**: 50+ RESTful endpoints covering all system functionality
- **Real-time Features**: Socket.IO integration for live updates
- **Activity Logging**: Comprehensive audit trail
- **Database Schema**: 11 models with relationships and constraints

#### Frontend (60% Complete)
- **Authentication Flow**: Login, logout, token management
- **Dashboard**: Statistics, recent activities, quick actions
- **Document Management**: List, search, filter, bulk operations
- **User Administration**: User CRUD with modal forms and role management
- **File Management**: Drag-and-drop upload, gallery view, file preview
- **Responsive Design**: Mobile-friendly layouts
- **Error Handling**: Toast notifications and loading states

### 🔄 In Progress
- Real-time notifications and live updates
- Advanced search with autocomplete
- Mobile optimization enhancements
- Global error boundaries
- Theme system (dark/light mode)

## 🛠️ Technology Stack

### Backend Dependencies
- **Express.js**: Web application framework
- **Prisma**: Database ORM and query builder
- **JWT**: Authentication tokens
- **Bcrypt**: Password hashing
- **Sharp**: Image processing
- **Socket.IO**: Real-time communication
- **Multer**: File upload handling
- **Helmet**: Security middleware
- **CORS**: Cross-origin resource sharing

### Frontend Dependencies
- **React**: UI framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool and dev server
- **TailwindCSS**: Utility-first CSS framework
- **React Query**: Data fetching and caching
- **React Router**: Client-side routing
- **React Hook Form**: Form handling
- **React Dropzone**: File upload component
- **Axios**: HTTP client
- **Lucide React**: Icon library

## 📁 Project Structure

```
cms-mock/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── middleware/      # Custom middleware
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Utility functions
│   │   └── app.ts           # Express app setup
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.ts          # Database seeding
│   ├── uploads/             # File storage
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── contexts/        # React contexts
│   │   ├── pages/           # Application pages
│   │   ├── services/        # API services
│   │   ├── types/           # TypeScript type definitions
│   │   └── App.tsx          # Main application component
│   ├── public/              # Static assets
│   └── package.json
├── status.md                # Development progress tracking
├── .gitignore
└── README.md
```

## 🚦 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL database
- npm or yarn package manager

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   Create a `.env` file in the backend directory:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/cms_db"
   JWT_SECRET="your-super-secret-jwt-key"
   JWT_REFRESH_SECRET="your-refresh-secret-key"
   PORT=3001
   NODE_ENV=development
   ```

4. **Database Setup**:
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run database migrations
   npx prisma migrate dev
   
   # Seed the database with sample data
   npx prisma db seed
   ```

5. **Start the backend server**:
   ```bash
   npm run dev
   ```

   The backend will run on `http://localhost:3001`

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Configuration**:
   Create a `.env` file in the frontend directory:
   ```env
   VITE_API_BASE_URL=http://localhost:3001/api
   VITE_SOCKET_URL=http://localhost:3001
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

   The frontend will run on `http://localhost:5173`

## 👥 User Roles & Permissions

The system includes four user roles with different access levels:

### 🔴 **ADMIN**
- Full system access
- User management (create, edit, delete users)
- System configuration
- All document and file operations

### 🔵 **CORRESPONDENCE_OFFICER**
- Document management (create, edit, assign)
- User management (limited)
- File management
- Department oversight

### 🟣 **DEPARTMENT_HEAD**
- Department document management
- Team member oversight
- Document approval workflow
- Departmental reporting

### 🟢 **DEPARTMENT_USER**
- Document viewing and creation
- File upload for assigned documents
- Basic system interaction

## 📊 Default Test Accounts

After running database seeding, you can login with:

**Administrator Account**:
- Email: `admin@hiast.edu.sy`
- Password: `admin123`

**Regular User Account**:
- Email: `fatima.sakr@hiast.edu.sy`
- Password: `password123`

## 🔧 Development Commands

### Backend Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run prisma:reset # Reset database
npm run seed         # Seed database
```

### Frontend Commands
```bash
npm run dev         # Start development server
npm run build       # Build for production
npm run preview     # Preview production build
npm run lint        # Run ESLint
npm run type-check  # TypeScript type checking
```

## 📈 Development Progress

**Overall Completion: 75%**

- ✅ Backend: 85% complete
- ✅ Frontend: 60% complete
- 🔄 Integration: Ready for testing

For detailed progress tracking, see [status.md](./status.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is developed for the Higher Institute for Applied Science and Technology (HIAST).

## 🆘 Support

For support and questions, please contact the development team or create an issue in the repository.

---

**Built with ❤️ for HIAST**