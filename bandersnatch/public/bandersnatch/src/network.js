class Network {
    constructor({ host }) {
        this.host = host;
    }

    parseManifestURL({ url, fileResolution, fileResolutionTag, hostTag}) {
        /**
         * Parse URL from manifestJSON
         * 
         * @param {string} url - url with $HOST and $RESOLUTION variables
         * @param {number} fileResolution - Resolution as number
         * @param {string} fileResolutionTag - Resolution tag from manifestJSON as $RESOLUTION
         * @param {string} hostTag - host tag from manifestJSON as $HOST
         */

        return url.replace(fileResolutionTag, fileResolution).replace(hostTag, this.host);
    }

    async fetchFile(url) {
        /**
         * Fetch file from url
         * 
         * @param {string} url - Parsed url
         */
        const response = await fetch(url);
        return response.arrayBuffer();
    }

    async getProperResolution(url) {
        const startMs = Date.now();
        const response = await fetch(url)
        await response.arrayBuffer();
        const endMs = Date.now();
        const durationMs = (endMs - startMs);
        // const throughPut = this.calcThroughput(startMs, endMs, bytes);

        const resolution = [
            { start: 3001, end: 20000, resolution: 144 },
            // greater than 900ms and less than 3 seconds
            { start: 901, end: 3000, resolution: 360 },
            // less than 1 second
            { start: 0, end: 900, resolution: 720 },
        ];

        const item = resolution.find(item => {
            return item.start <= durationMs && item.end >= durationMs;
        });

        const LOWEST_RESOLUTION = 144;
        if(!item) return LOWEST_RESOLUTION;

        return item.resolution;
    }

    // calcThroughput(startMs, endMs, bytes) {
    //     const throughputKpbs = (bytes * 8) / (endMs - startMs);
    //     return throughputKpbs;
    // }
}