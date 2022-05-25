const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_KEY);


// middleware
app.use(cors());
app.use(express.json());


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
        const orderCollection = client.db("bicycel-parts").collection("order");
        const paymentsCollection = client.db("bicycel-parts").collection("payment");

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

        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.deleteOne(query);
            res.send(order);
        })

        app.get('/order/:id', verifyjwt, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const order = await orderCollection.findOne(query);
            res.send(order);
        })

        app.get('/users', verifyjwt, async (req, res) => {
            const users = await usersCollection.find().toArray();
            res.send(users);
        })

        app.delete('/users/:id', verifyjwt, async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        app.put('/admin/:email', verifyjwt, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.get('/review', async (req, res) => {
            const users = await reviwsCollection.find().toArray();
            const comment = users.length - 6;
            const result = await reviwsCollection.find().skip(comment).toArray();
            res.send(result);
        })

        app.post('/review', async (req, res) => {
            const query = req.body;
            const result = await reviwsCollection.insertOne(query);
            res.send(result);
        })

        app.post('/addParts', verifyjwt, verifyAdmin, async (req, res) => {
            const query = req.body;
            const result = await partsCollection.insertOne(query);
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

        // app.put('/orderAll/:id', async (req, res) => {
        //     const id = req.params.id;
        //     const filter = { _id: ObjectId(id) };
        //     const updateDoc = {
        //         $set: { delivary: "shipped" },
        //     };
        //     const result = await orderCollection.updateOne(filter, updateDoc);
        //     res.send(result);
        // })

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

        app.get('/orderAll', verifyjwt, verifyAdmin, async (req, res) => {
            const order = await orderCollection.find().toArray();
            res.send(order);
        })

        app.post('/order', async (req, res) => {
            const order = req.body;
            const rasult = await orderCollection.insertOne(order);
            return res.send({ success: true, rasult });
        })

        app.get('/order', verifyjwt, async (req, res) => {
            const email = req.query.user;
            const decoddedEmail = req.decoded.email;
            if (email === decoddedEmail) {
                const query = { email: email };
                const rasult = await orderCollection.find(query).toArray();
                return res.send(rasult);
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' });
            }
        })

        app.post('/create-payment-intent', verifyjwt, async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent.client_secret })
        })

        app.patch('/order/:id', verifyjwt, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updateDoc = {
                $set: {
                    paid: true,
                    trnangectionId: payment.trnangectionId
                }
            }
            const updateOrder = await orderCollection.updateOne(filter, updateDoc);
            const result = await paymentsCollection.insertOne(payment);
            res.send(updateOrder);
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