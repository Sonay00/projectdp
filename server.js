const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const port = process.env.PORT || 5000;

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret', resave: true, saveUninitialized: true }));

// Serve static files from the "public" folder
app.use(express.static('public'));

// Set up the view engine for EJS
app.set('view engine', 'ejs');
app.set('views', './views');

// MySQL database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Universal2021!',
    database: 'TaskManagement'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL Database');
});

// Handle signup
app.post('/signup', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);

    const sql = 'INSERT INTO users (username, password, role) VALUES (?, ?, "worker")';
    db.query(sql, [username, hashedPassword], (err) => {
        if (err) {
            console.error("Error during signup:", err);
            return res.send('Error occurred during signup. Please try again.');
        }
        res.redirect('/login');
    });
});

// Handle login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const sql = 'SELECT * FROM users WHERE username = ?';
    db.query(sql, [username], (err, results) => {
        if (err) throw err;
        if (results.length > 0 && bcrypt.compareSync(password, results[0].password)) {
            req.session.user = results[0];
            res.redirect('/dashboard');
        } else {
            res.send('Incorrect Username or Password');
        }
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
    const sqlTasks = isAdmin ? 'SELECT * FROM tasks' : 'SELECT * FROM tasks WHERE assigned_to = ?';
    const paramsTasks = isAdmin ? [] : [user.id];

    db.query(sqlTasks, paramsTasks, (err, tasks) => {
        if (err) throw err;

        if (isAdmin) {
            // Fetch all workers for assignment dropdown if the user is an admin
            const sqlWorkers = 'SELECT id, username FROM users WHERE role = "worker"';
            db.query(sqlWorkers, (err, workers) => {
                if (err) throw err;

                // Render the dashboard with tasks and workers for admin
                res.render('dashboard', { user, tasks, isAdmin, workers });
            });
        } else {
            // Render the dashboard with tasks (without workers) for non-admins
            res.render('dashboard', { user, tasks, isAdmin });
        }
    });
});

// Handle task assignment
app.post('/assign-task', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }

    const { title, description, deadline, assigned_to } = req.body;

    const sql = 'INSERT INTO tasks (title, description, deadline, assigned_to, status) VALUES (?, ?, ?, ?, "pending")';
    db.query(sql, [title, description, deadline, assigned_to], (err) => {
        if (err) throw err;
        res.redirect('/dashboard');
    });
});

// Handle task completion
app.post('/complete-task', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'worker') {
        return res.redirect('/login');
    }

    const { task_id } = req.body;
    const sql = 'UPDATE tasks SET status = "completed" WHERE id = ?';
    db.query(sql, [task_id], (err) => {
        if (err) throw err;
        res.redirect('/dashboard');
    });
});

// Handle feedback
app.post('/give-feedback', (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.redirect('/login');
    }

    const { task_id, feedback } = req.body;
    const sql = 'UPDATE tasks SET feedback = ? WHERE id = ?';
    db.query(sql, [feedback, task_id], (err) => {
        if (err) throw err;
        res.redirect('/dashboard');
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
    const sqlWorkers = 'SELECT id, username FROM users WHERE role = "worker"';
    db.query(sqlWorkers, (err, workers) => {
        if (err) throw err;
        res.render('assign-task', { workers });
    });
});

// Start the server
app.listen(3000, () => console.log('Server running on http://localhost:3000'));
