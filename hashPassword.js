const bcrypt = require('bcryptjs');

bcrypt.hash('Suad99339933', 10, (err, hash) => {
    if (err) throw err;
    console.log("Hashed password:", hash);
});
