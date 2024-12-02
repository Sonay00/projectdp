const express = require('express');
const { Pool } = require('pg'); // Use pg for PostgreSQL
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'secret',
        resave: true,
        saveUninitialized: true,
    })
);

// Serve static files from the "public" folder
app.use(express.static('public'));

// Set up the view engine for EJS
app.set('view engine', 'ejs');
app.set('views', './views');

// PostgreSQL database connection
const db = new Pool({
    connectionString: process.env.DATABASE_URL, // Use Heroku's DATABASE_URL environment variable
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, // Enable SSL in production
});

db.connect()
    .then(() => console.log('Connected to PostgreSQL Database'))
    .catch((err) => console.error('Database connection error:', err.stack));

// Handle signup
app.post('/signup', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);

    const sql = 'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)';
    db.query(sql, [username, hashedPassword, 'worker'])
        .then(() => res.redirect('/login'))
        .catch((err) => {
            console.error('Error during signup:', err);
            res.send('Error occurred during signup. Please try again.');
        });
});

// Handle login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const sql = 'SELECT * FROM users WHERE username = $1';
    db.query(sql, [username])
        .then((result) => {
            if (result.rows.length > 0 && bcrypt.compareSync(password, result.rows[0].password)) {
                req.session.user = result.rows[0];
                res.redirect('/dashboard');
            } else {
                res.send('Incorrect Username or Password');
            }
        })
        .catch((err) => {
            console.error(err);
            res.send('Error occurred during login.');
        });
});

// Dashboard route
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    const user = req.session.user;
    const isAdmin = user.role === 'admin';

    // Get tasks based on user role
    const sqlTasks = isAdmin ? 'SELECT * FROM tasks' : 'SELECT * FROM tasks WHERE assigned_to = $1';
    const paramsTasks = isAdmin ? [] : [user.id];

    db.query(sqlTasks, paramsTasks)
        .then((tasksResult) => {
            const tasks = tasksResult.rows;

            if (isAdmin) {
                // Fetch all workers for assignment dropdown if the user is an admin
                const sqlWorkers = 'SELECT id, username FROM users WHERE role = $1';
                db.query(sqlWorkers, ['worker'])
                    .then((workersResult) => {
                        const workers = workersResult.rows;
                        // Render the dashboard with tasks and workers for admin
                        res.render('dashboard', { user, tasks, isAdmin, workers });
                    })
                    .catch((err) => {
                        console.error(err);
                        res.send('Database error');
                    });
            } else {
                // Render the dashboard with tasks (without workers) for non-admins
                res.render('dashboard', { user, tasks, isAdmin });
            }
        })
        .catch((err) => {
            console.error(err);
            res.send('Database error');
        });
});

// Handle task assignment
app.post('/assign-task', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }

    const { title, description, deadline, assigned_to } = req.body;

    const sql =
        'INSERT INTO tasks (title, description, deadline, assigned_to, status) VALUES ($1, $2, $3, $4, $5)';
    db.query(sql, [title, description, deadline, assigned_to, 'pending'])
        .then(() => res.redirect('/dashboard'))
        .catch((err) => {
            console.error(err);
            res.send('Error assigning task');
        });
});

// Handle task completion
app.post('/complete-task', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'worker') {
        return res.redirect('/login');
    }

    const { task_id } = req.body;
    const sql = 'UPDATE tasks SET status = $1 WHERE id = $2';
    db.query(sql, ['completed', task_id])
        .then(() => res.redirect('/dashboard'))
        .catch((err) => {
            console.error(err);
            res.send('Error completing task');
        });
});

// Handle feedback
app.post('/give-feedback', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }

    const { task_id, feedback } = req.body;
    const sql = 'UPDATE tasks SET feedback = $1 WHERE id = $2';
    db.query(sql, [feedback, task_id])
        .then(() => res.redirect('/dashboard'))
        .catch((err) => {
            console.error(err);
            res.send('Error giving feedback');
        });
});

// Login page
app.get('/', (req, res) => {
    res.render('login');
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.get('/login', (req, res) => {
    res.render('login');
});

// Task assignment page
app.get('/assign-task', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }

    // Fetch all workers for the task assignment dropdown
    const sqlWorkers = 'SELECT id, username FROM users WHERE role = $1';
    db.query(sqlWorkers, ['worker'])
        .then((workersResult) => {
            const workers = workersResult.rows;
            res.render('assign-task', { workers });
        })
        .catch((err) => {
            console.error(err);
            res.send('Error loading workers');
        });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
