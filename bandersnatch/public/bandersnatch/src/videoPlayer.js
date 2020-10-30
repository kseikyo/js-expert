class VideoMediaPlayer {
    constructor({ manifestJSON, network, videoComponent }) {
        this.manifestJSON = manifestJSON;
        this.network = network;
        this.videoComponent = videoComponent;

        this.videoElement;
        this.sourceBuffer;
        this.selected = {};
        this.activeItem = {};
        this.videoDuration = 0;
        this.selections = [];
    }

    initializeCodec() {
        this.videoElement = document.querySelector("#vid");
        const mediaSourceSupported = !!window.MediaSource;
        if (!mediaSourceSupported) {
            alert("Seu browser ou sistema não tem suporte a MSE!");
            return;
        }

        const codecSupported = MediaSource.isTypeSupported(this.manifestJSON.codec);
        if (!codecSupported) {
            alert(`Seu browser não suporta o codec : ${this.manifestJSON.codec}`);
        }

        const mediaSource = new MediaSource();
        this.videoElement.src = URL.createObjectURL(mediaSource);

        mediaSource.addEventListener("sourceopen", this.sourceOpenWrapper(mediaSource));
    }

    sourceOpenWrapper(mediaSource) {
        /**
         * Creates sourceBuffer using mediaSource.addSourceBuffer with codec from 
         * manifestJSON
         * @param mediaSource {MediaSource} - 
         */
        return async (_) => {
            this.sourceBuffer = mediaSource.addSourceBuffer(this.manifestJSON.codec);
            const selected = this.selected = this.manifestJSON.intro;

            // Evitar mostrar como livestream (remove on production)
            mediaSource.duration = this.videoDuration;

            await this.fileDownload(selected.url);
            setInterval(this.waitForQuestions.bind(this), 200);
        }
    }

    waitForQuestions() {
        /**
         * Calculates current time of video to show questions when defined to
         * Options will show when time of selected.at is equal to currentTime
         * Also, if modal has been shown once, it will just return
         */
        const currentTime = parseInt(this.videoElement.currentTime);
        const option = this.selected.at === currentTime;
        if (!option) return;
        if (this.activeItem.url === this.selected.url) return;
        this.videoComponent.configureModal(this.selected.options);
        this.activeItem = this.selected;
    }

    async currentFileResolution() {
        const prepareUrl = {
            url: this.manifestJSON.videoTest.url,
            hostTag: this.manifestJSON.hostTag,
        }

        const url = this.network.parseManifestURL(prepareUrl);
        return this.network.getProperResolution(url);
    }

    async nextChunk(data) {
        /**
         * Will get the item the user selected on modal
         * Get its data from manifestJSON and make it this.selected
         * 
         */
        const key = data.toLowerCase();
        const selected = this.manifestJSON[key];
        this.selected = {
            ...selected,
            // Adjusts time modal will show up, based on currentTime
            at: parseInt(this.videoElement.currentTime + selected.at)
        }
        this.manageLag(selected);
        this.videoElement.play();
        await this.fileDownload(selected.url);
    }

    manageLag(selected) {
        if(!!~this.selections.indexOf(selected.url)) {
            selected.at += 4;
            return;
        }

        this.selections.push(selected.url);
    }

    async fileDownload(url) {
        /**
         * Download video from server listed on manifestJSON
         * @param {string} url - Path to video
         */
        const fileResolution = await this.currentFileResolution();
        const prepareUrl = {
            url,
            fileResolution,
            fileResolutionTag: this.manifestJSON.fileResolutionTag,
            hostTag: this.manifestJSON.hostTag
        };
        const finalUrl = this.network.parseManifestURL(prepareUrl);
        this.setVideoPlayerDuration(finalUrl);
        const data = await this.network.fetchFile(finalUrl);
        return this.processBufferSegments(data);
    }

    setVideoPlayerDuration(finalURL) {
        /**
         * Get name and videoDuration from video on format
         * NAME-DURATION-RESOLUTION.mp4
         * 
         * @param {string} finalURL - Parsed Video URL
         */
        const bars = finalURL.split('/');
        const [name, videoDuration] = bars[bars.length - 1].split('-');
        this.videoDuration += parseFloat(videoDuration);
    }

    async processBufferSegments(allSegments) {
        /**
         * Function to respect javascripts lifecicle
         * 
         * @param {Promisse<ArrayBuffer>} allSegments - Video data as ArrayBuffer 
         * 
         * The sourceBuffer that contains the whole video appends the new Video segments
         * but to prevent javascript from getting into an infinite loop its created a Promise
         * to wait until the updateend event in the sourceBuffer to finish, then it will remove
         * itself and update the video Duration.
         */
        const sourceBuffer = this.sourceBuffer;
        sourceBuffer.appendBuffer(allSegments);

        return new Promise((resolve, reject) => {
            const updateEnd = (_) => {
                sourceBuffer.removeEventListener("updateend", updateEnd);
                sourceBuffer.timestampOffset = this.videoDuration;

                return resolve();
            };

            sourceBuffer.addEventListener("updateend", updateEnd);
            sourceBuffer.addEventListener("error", reject);
        });
    }
}