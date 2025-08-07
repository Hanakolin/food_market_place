# Food Marketplace Platform

A comprehensive web-based food delivery marketplace connecting customers with restaurants (cooks). Built with React, Node.js, Express, and MySQL.

## 🚀 Features

### Customer Features
- Browse restaurants and food items
- Add items to cart and place orders
- Track order status in real-time
- View order history
- Leave reviews and ratings
- Request refunds

### Cook/Restaurant Features
- Manage restaurant profile
- Add/edit/remove menu items
- Receive and manage orders
- Track order stages (Pending → Confirmed → Preparing → Sent to Delivery → Delivered)
- View sales analytics and reports
- Handle refund requests

### Admin Features
- Oversee all platform data and activity
- Manage user accounts
- Monitor order flow
- Handle disputes and refunds

## 🛠 Tech Stack

### Backend
- **Node.js** with Express.js
- **MySQL** database with connection pooling
- **JWT** for authentication
- **Socket.io** for real-time updates
- **Multer** for file uploads
- **bcryptjs** for password hashing
- **express-validator** for data validation

### Frontend  
- **React 19** with TypeScript
- **Material-UI (MUI)** for components
- **React Router** for navigation
- **TanStack Query** for data fetching
- **Socket.io-client** for real-time features
- **Axios** for HTTP requests

### Database
- **MySQL** with comprehensive relational schema
- Support for users, restaurants, orders, reviews, and more
- Optimized indexes for performance

## 🏗 Project Structure

```
food-marketplace/
├── backend/           # Node.js API server
│   ├── config/        # Database configuration
│   ├── controllers/   # Route controllers
│   ├── middleware/    # Authentication & validation
│   ├── routes/        # API endpoints
│   ├── uploads/       # File storage
│   └── server.js      # Main server file
├── frontend/          # React application
│   ├── src/           # Source code
│   ├── public/        # Static files
│   └── package.json   # Dependencies
├── database/          # Database schema
│   └── schema.sql     # MySQL schema & sample data
└── README.md          # This file
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- MySQL (via XAMPP or standalone)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd food-marketplace
   ```

2. **Set up the database**
   - Start your XAMPP MySQL server
   - Open phpMyAdmin or MySQL command line
   - Import and run `database/schema.sql`
   - This will create the database and tables with sample data

3. **Configure Backend**
   ```bash
   cd backend
   npm install
   ```
   
   - Copy `.env.example` to `.env`
   - Update database credentials in `.env`:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=        # Your MySQL password (usually empty for XAMPP)
   DB_NAME=food_marketplace
   DB_PORT=3306
   ```

4. **Configure Frontend**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev        # Development mode with nodemon
   # or
   npm start          # Production mode
   ```
   
   Backend runs on: http://localhost:5000

2. **Start the frontend** (in new terminal)
   ```bash
   cd frontend
   npm start
   ```
   
   Frontend runs on: http://localhost:3000

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/change-password` - Change password

### Restaurants
- `GET /api/restaurants` - Get all restaurants
- `GET /api/restaurants/:id` - Get restaurant details
- `POST /api/restaurants` - Create restaurant (Cook only)

### Food Items
- `GET /api/food/restaurant/:id` - Get restaurant menu
- `GET /api/food/categories` - Get food categories

### Orders
- `GET /api/orders` - Get user orders
- `POST /api/orders` - Create new order
- `GET /api/orders/:id` - Get order details
- `PATCH /api/orders/:id/status` - Update order status

### User Features
- `GET /api/users/cart` - Get cart items
- `POST /api/users/cart` - Add to cart
- `DELETE /api/users/cart/:id` - Remove from cart

## 🔐 Default Admin Account

- **Email:** admin@foodmarketplace.com
- **Password:** admin123

*Note: Change this password in production!*

## 🔄 Real-time Features

The platform uses Socket.io for real-time updates:
- Order status notifications for customers
- New order alerts for restaurants
- Live order tracking

## 📊 Database Schema

The database includes these main tables:
- `users` - Customer, cook, and admin accounts
- `restaurants` - Restaurant profiles
- `food_items` - Menu items
- `orders` & `order_items` - Order management
- `reviews` - Customer reviews
- `refunds` - Refund requests
- `cart_items` - Shopping cart
- `categories` - Food categories

## 🛡 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Input validation and sanitization
- Rate limiting
- CORS protection
- Helmet security headers
- File upload restrictions

## 🔧 Environment Variables

Backend `.env` file:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=food_marketplace
DB_PORT=3306
PORT=5000
JWT_SECRET=your_jwt_secret_here
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

## 📱 Responsive Design

The frontend is built with Material-UI components and is fully responsive, working seamlessly on:
- Desktop computers
- Tablets
- Mobile phones

## 🚀 Production Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use a secure JWT secret
3. Configure proper database credentials
4. Set up file storage (AWS S3, etc.)
5. Configure email service for notifications
6. Set up SSL certificates
7. Use a process manager like PM2

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Create a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

If you encounter any issues:
1. Check the database connection
2. Ensure all dependencies are installed
3. Verify environment variables
4. Check console logs for errors

For additional help, please create an issue in the repository.

---

**Built with ❤️ for food lovers and entrepreneurs!**
