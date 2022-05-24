const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
// const stripe = require("stripe")(process.env.STRIPE_KEY);


// middleware
app.use(cors());
app.use(express.json());

const verifyAdmin = async (req, res, next) => {
    const requester = req.decoded.email;
    const requesterAccount = await usersCollection.findOne({ email: requester });
    if (requesterAccount.role === 'admin') {
        next();
    }
    else {
        res.status(403).send({ message: 'forbidden' });
    }
}

function verifyjwt(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'unAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbedden access' })
        }
        req.decoded = decoded;
        next();
    })
}



const uri = `mongodb+srv://bicycelDb:${process.env.DB_PASS}@cluster0.uekf7.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {

    try {
        await client.connect();
        const partsCollection = client.db("bicycel-parts").collection("parts");
        const usersCollection = client.db("bicycel-parts").collection("users");
        const reviwsCollection = client.db("bicycel-parts").collection("review");

        app.get("/parts", async (req, res) => {
            const parts = await partsCollection.find().toArray();
            res.send(parts);
        })

        app.get('/parts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const parts = await partsCollection.findOne(query);
            res.send(parts);
        })

        app.get('/users', verifyjwt, async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        })

        app.get('/review', async (req, res) => {
            const users = await reviwsCollection.find().toArray();
            const comment = users.length - 6;
            const result = await reviwsCollection.find().skip(comment).toArray();
            res.send(result);
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const user = req.body;
            const option = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await usersCollection.updateOne(filter, updateDoc, option);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
            res.send({ result, token });
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await usersCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        app.put('/user/admin/:email', verifyjwt, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

    }
    finally { }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})