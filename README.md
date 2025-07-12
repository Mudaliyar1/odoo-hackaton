# Skill Swap Platform

## 📋 Problem Statement 1: Skill Swap Platform

### Overview:
Develop a Skill Swap Platform — a mini application that enables users to list their skills and request others in return.

### Features:

#### User Profile Management:
- **Basic info**: Name, location (optional), profile photo (optional)
- **List of skills offered**
- **List of skills wanted**
- **Availability** (e.g., weekends, evenings)
- **Privacy Control**: User can make their profile public or private

#### Skill Discovery & Search:
- Users can browse or search others by skill (e.g., "Photoshop" or "Excel")
- Advanced filtering and search capabilities

#### Request & Accept Swaps:
- Accept or reject swap offers
- Show current and pending swap requests
- **Ratings or feedback** after a swap
- **Delete swap requests** if not accepted

#### Admin Role:
- **Content Moderation**: Reject inappropriate or spammy skill descriptions
- **User Management**: Ban users who violate platform policies
- **Swap Monitoring**: Monitor pending, accepted, or cancelled swaps
- **Communication**: Send platform-wide messages (e.g., feature updates, downtime alerts)
- **Analytics & Reporting**: Download reports of user activity, feedback logs, and swap stats

---

A comprehensive web application for skill exchange and learning, built for the Odoo Hackathon. This platform allows users to share their skills, find mentors, and engage in skill swapping activities within a community-driven environment.

## 🚀 Features

### User Features
- **User Authentication**: Secure registration and login system
- **Profile Management**: Comprehensive user profiles with skill listings
- **Skill Discovery**: Search and browse available skills from other users
- **Skill Swapping**: Request and offer skill exchange sessions
- **Dashboard**: Personalized user dashboard with activity overview
- **Contact System**: Direct communication between users
- **Feedback System**: Rate and review skill exchange experiences

### Admin Features
- **Admin Dashboard**: Comprehensive admin panel for platform management
- **User Management**: Create, edit, and manage user accounts
- **Content Moderation**: Review and moderate user-generated content
- **Announcements**: Create and manage platform-wide announcements
- **Reports & Analytics**: Monitor platform usage and user activity
- **Contact Management**: Handle user inquiries and support requests

## 🛠️ Technology Stack

- **Backend**: Node.js with Express.js framework
- **Database**: MongoDB (implied from model structure)
- **Template Engine**: EJS for server-side rendering
- **Authentication**: Custom authentication middleware
- **File Upload**: Multer for handling profile photos and file uploads
- **Frontend**: HTML, CSS, JavaScript
- **Styling**: Custom CSS with modern responsive design

## 📋 Prerequisites

Before running this application, make sure you have the following installed:

- Node.js (v14.0.0 or higher)
- npm (v6.0.0 or higher)
- MongoDB (v4.0 or higher)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Mudaliyar1/odoo-hackaton.git
   cd odoo-hackaton
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory and add the following variables:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/skillswap
   SESSION_SECRET=your_session_secret_here
   NODE_ENV=development
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system.

5. **Run the application**
   ```bash
   npm start
   ```

   For development with auto-restart:
   ```bash
   npm run dev
   ```

6. **Access the application**
   Open your browser and navigate to `http://localhost:3000`

## 📁 Project Structure

```
├── app.js                 # Main application file
├── package.json          # Project dependencies and scripts
├── controllers/          # Business logic controllers
├── middleware/           # Custom middleware
│   ├── auth.js          # Authentication middleware
│   └── upload.js        # File upload middleware
├── models/              # Database models
│   ├── Announcement.js  # Announcement model
│   ├── Contact.js       # Contact model
│   ├── Feedback.js      # Feedback model
│   ├── SkillSwap.js     # Skill swap model
│   └── User.js          # User model
├── routes/              # API routes
│   ├── admin.js         # Admin routes
│   ├── auth.js          # Authentication routes
│   ├── pages.js         # Static page routes
│   ├── swaps.js         # Skill swap routes
│   └── users.js         # User management routes
├── views/               # EJS templates
│   ├── admin/           # Admin panel views
│   ├── auth/            # Authentication views
│   ├── pages/           # Static page views
│   ├── partials/        # Reusable template components
│   ├── swaps/           # Skill swap views
│   └── users/           # User-related views
└── public/              # Static assets
    ├── css/             # Stylesheets
    ├── js/              # Client-side JavaScript
    └── uploads/         # User uploaded files
```

## 🎯 Usage

### For Users
1. **Register**: Create a new account with your details
2. **Complete Profile**: Add your skills and areas of interest
3. **Browse Skills**: Explore skills offered by other users
4. **Request Swaps**: Send skill exchange requests
5. **Manage Sessions**: Track your ongoing and completed skill swaps
6. **Provide Feedback**: Rate and review your experiences

### For Administrators
1. **Access Admin Panel**: Login with admin credentials
2. **Manage Users**: Create, edit, or suspend user accounts
3. **Monitor Activity**: Review platform usage and user interactions
4. **Handle Reports**: Address user complaints and issues
5. **Create Announcements**: Communicate with the user community

## 🔐 Authentication

The application uses session-based authentication with the following features:
- Secure password hashing
- Session management
- Role-based access control (User/Admin)
- Protected routes for authenticated users

## 📱 API Endpoints

### Authentication
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /auth/logout` - User logout

### User Management
- `GET /users/profile` - View user profile
- `PUT /users/profile` - Update user profile
- `GET /users/search` - Search for users
- `GET /users/dashboard` - User dashboard

### Skill Swaps
- `GET /swaps` - List skill swaps
- `POST /swaps/create` - Create new skill swap
- `GET /swaps/:id` - View skill swap details
- `PUT /swaps/:id` - Update skill swap

### Admin
- `GET /admin/dashboard` - Admin dashboard
- `GET /admin/users` - Manage users
- `GET /admin/reports` - View reports
- `POST /admin/announcements` - Create announcements

## 🎨 Customization

The application supports easy customization through:
- CSS variables for theming
- Modular EJS templates
- Configurable environment variables
- Extensible model schemas

## 🐛 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check the connection string in your environment variables

2. **Port Already in Use**
   - Change the PORT in your `.env` file
   - Kill any processes using the current port

3. **File Upload Issues**
   - Check file permissions in the `public/uploads` directory
   - Verify multer configuration

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Hackathon Project

This project was developed for the Odoo Hackathon, focusing on creating an innovative skill-sharing platform that promotes community learning and knowledge exchange.

## 📞 Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team
- Check the documentation in the `/docs` folder (if available)

## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
- More versions to be documented as the project evolves

---

**Built with ❤️ for the Odoo Hackathon**