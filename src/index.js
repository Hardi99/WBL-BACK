import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authenticateUser from './middleware/auth.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const prisma = new PrismaClient();
const SECRET_KEY = process.env.JWT_SECRET;

app.use(express.json());
app.use(cors());

// Add a GET /api/dreams endpoint to fetch all dreams
app.get('/api/dreams', async (req, res) => {
    try {
        const dreams = await prisma.dream.findMany();
        res.json(dreams);
    } catch (error) {
        console.error('Error fetching dreams:', error);
        res.status(500).json({ error: 'Failed to fetch dreams' });
    }
});

// Protect the POST /api/dreams endpoint with authentication middleware
app.post('/api/dreams', authenticateUser, async (req, res) => {
    const { description, imagePath, selectedStreetView, latitude, longitude } = req.body;
    const userId = req.user.userId;
    try {
        const dream = await prisma.dream.create({
            data: {
                description,
                imagePath,
                done: false,
                latitude,
                longitude,
                userId,
                streetViewImage: selectedStreetView,
            },
        });
        res.status(201).json({ message: 'Dream created successfully', dream });
    } catch (error) {
        console.error('Error creating dream:', error);
        res.status(500).json({ error: 'Failed to create dream' });
    }
});

// Endpoint to fetch coordinates and Street View URLs
app.post('/api/dreams/coordinates', async (req, res) => {
    const { address } = req.body;
    try {
        const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address,
                key: process.env.GOOGLE_API_KEY,
            },
        });

        const location = geocodeResponse.data.results[0].geometry.location;
        const headings = [0, 90, 180, 270]; // Different headings for Street View
        const streetViewUrls = headings.map((heading) =>
            `https://maps.googleapis.com/maps/api/streetview?size=600x300&location=${location.lat},${location.lng}&heading=${heading}&key=${process.env.GOOGLE_API_KEY}`
        );

        res.json({ location, streetViewUrls });
    } catch (error) {
        console.error('Error fetching coordinates or Street View:', error);
        res.status(500).json({ error: 'Failed to fetch coordinates or Street View' });
    }
});

// Add user creation and login endpoints
app.post('/api/users/register', async (req, res) => {
    const { email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashedPassword },
        });
        res.status(201).json({ message: 'User created successfully', user });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.post('/api/users/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: 'Failed to log in' });
    }
});

// Add a GET /api/dreams/:id endpoint to fetch a specific dream
app.get('/api/dreams/:id', async (req, res) => {
    try {
        const dream = await prisma.dream.findUnique({
            where: { id: parseInt(req.params.id) },
        });
        if (!dream) {
            return res.status(404).json({ error: 'Dream not found' });
        }
        res.json(dream);
    } catch (error) {
        console.error('Error fetching dream:', error);
        res.status(500).json({ error: 'Failed to fetch dream' });
    }
});

// Add a PUT /api/dreams/:id endpoint to update a dream
app.put('/api/dreams/:id', authenticateUser, async (req, res) => {
    const { description, imagePath, latitude, longitude, streetViewImage } = req.body;
    try {
        const dream = await prisma.dream.update({
            where: { id: parseInt(req.params.id) },
            data: {
                description,
                imagePath,
                latitude,
                longitude,
                streetViewImage,
            },
        });
        res.json(dream);
    } catch (error) {
        console.error('Error updating dream:', error);
        res.status(500).json({ error: 'Failed to update dream' });
    }
});

// Add a DELETE /api/dreams/:id endpoint to delete a dream
app.delete('/api/dreams/:id', authenticateUser, async (req, res) => {
    try {
        await prisma.dream.delete({
            where: { id: parseInt(req.params.id) },
        });
        res.json({ message: 'Dream deleted successfully' });
    } catch (error) {
        console.error('Error deleting dream:', error);
        res.status(500).json({ error: 'Failed to delete dream' });
    }
});

// Add a PATCH /api/dreams/:id endpoint to update dream status
app.patch('/api/dreams/:id', authenticateUser, async (req, res) => {
    const { done } = req.body;
    try {
        const dream = await prisma.dream.update({
            where: { id: parseInt(req.params.id) },
            data: { done },
        });
        res.json(dream);
    } catch (error) {
        console.error('Error updating dream status:', error);
        res.status(500).json({ error: 'Failed to update dream status' });
    }
});

app.all('*', (req, res) => {
    res.status(404).json({message: 'Cette route n\'existe pas'})
})

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});