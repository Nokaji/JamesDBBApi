import dotenv from 'dotenv';
dotenv.config();


const APP = {
    ENV: process.env.NODE_ENV,
    PORT: Number(process.env.APP_PORT!),
    HOST: process.env.APP_HOST!,
};

export default { APP };