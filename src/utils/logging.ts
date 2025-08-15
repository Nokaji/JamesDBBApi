class Logging {
    private static instances: Logging[] = [];
    private logger: {
        name: string;
    } = { name: "JamesDbAPI" };

    private constructor() {

    }

    public static getInstance(NameLogger: string = "JamesDbAPI"): Logging {
        let instance = Logging.instances.find(i => i.logger.name === NameLogger);
        if (!instance) {
            instance = new Logging();
            instance.logger.name = NameLogger;
            Logging.instances.push(instance);
        }
        return instance;
    }

    private formatMessage(level: string, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${this.logger.name}] [${level}]: ${message}`;
    }

    public log(message: string, ...optionalParams: any[]) {
        console.log(this.formatMessage('LOG', message), ...optionalParams);
    }

    public error(message: string, ...optionalParams: any[]) {
        console.error(this.formatMessage('ERROR', message), ...optionalParams);
    }

    public warn(message: string, ...optionalParams: any[]) {
        console.warn(this.formatMessage('WARN', message), ...optionalParams);
    }

    public info(message: string, ...optionalParams: any[]) {
        console.info(this.formatMessage('INFO', message), ...optionalParams);
    }

    public debug(message: string, ...optionalParams: any[]) {
        console.debug(this.formatMessage('DEBUG', message), ...optionalParams);
    }

    public trace(message: string, ...optionalParams: any[]) {
        console.trace(this.formatMessage('TRACE', message), ...optionalParams);
    }
};

export default Logging;