const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const path = require('path');

app.use(express.static(__dirname));

const fs = require('fs');

const DATA_FILE = path.join(__dirname, 'data.json');