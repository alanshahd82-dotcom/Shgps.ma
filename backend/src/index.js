import express from 'express'
    import cors from 'cors'
    import dotenv from 'dotenv'
    import { authRouter }    from './routes/auth.js'
    import { devicesRouter } from './routes/devices.js'
    import { clientsRouter } from './routes/clients.js'
    import { alertsRouter }  from './routes/alerts.js'
    import { mapRouter }     from './routes/map.js'

    dotenv.config()

    const app  = express()
    const PORT = process.env.PORT || 3001

    app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }))
    app.use(express.json())

    app.use('/api/auth',    authRouter)
    app.use('/api/devices', devicesRouter)
    app.use('/api/clients', clientsRouter)
    app.use('/api/alerts',  alertsRouter)
    app.use('/api/map',     mapRouter)

    app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '1.0.0' }))

    app.listen(PORT, () => console.log(`🚀 SHGPS Backend running on port ${PORT}`))
    