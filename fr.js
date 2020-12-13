const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');

const { FormRecognizerClient, AzureKeyCredential } = require("@azure/ai-form-recognizer");
const fs = require("fs");
const endpoint = "https://krisformrecognizerapi.cognitiveservices.azure.com/";
const apiKey = "e1c94ec0bba4440da2e7d7536c2f08df";

const app = express();

// enable files upload
app.use(fileUpload({
    createParentPath: true
}));

//add other middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(express.static(__dirname));

//swagger specs
const swaggerJsdoc2 = require('swagger-jsdoc');
const swaggerUI2 = require('swagger-ui-express');

const { body, validationResult } = require('express-validator');

var validUrl = require('valid-url');



const options = {
    swaggerDefinition: {
        info: {
            title: 'Form Recognizer API',
            version: '1.0.0',
            description: 'Form Recognizer API can be used automatically scan and read data from any jpeg or pdf file. The recognized data is retuned in json format'
        },
        host: '206.189.199.15:3000',
        basePath: '/',
    },
    apis: ['./fr.js'],
};
//start app 
const port = process.env.PORT || 3000;

app.listen(port, () =>
    console.log(`App is listening on port ${port}.`)
);

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/homepage.html');
    //res.end('hello! welcome to form recognizer home page');
});

/**
 * @swagger
 * definitions:
 *   URL:
 *     properties:
 *       URLstring:
 *         type: string      
 */

/**
 * @swagger
 * /FormRecognizerApi/v1/Form/ReadfromFile:
 *   post:
 *     summary: Upload a file of the form in jpeg/pdf/png/tiff formats 
 *     tags:
 *       - Form
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: myfile
 *         type: file
 *         description: The file to upload. File size limit 10 MB.
 *     responses:
*       200:
 *         description: Form data recognized from the file
 *       400:
 *         description: Bad request or invalid file uploaded
 *       500:
 *         description: Error during form recognition           
 */
app.post('/FormRecognizerApi/v1/Form/ReadfromFile', async (req, res) => {
    try {
        if (!req.files) {
            res.status(400).send({
                status: "FAILED",
                message: 'No file uploaded'
            });
        } else {
            //Use the name of the input field (i.e. "myfile") to retrieve the uploaded file
            let myfile = req.files.myfile;
            if (myfile.size > 10000000) {
                res.status(400).send({
                    status: "FAILED",
                    message: 'File Too Large. Greater than 10 MB'
                });

            }
            else {

                console.log("file type is ----" + myfile.mimetype);
                const fileExtType = myfile.mimetype;

                if (fileExtType.toString().includes("pdf") || fileExtType.toString().includes("png")
                    || fileExtType.toString().includes("jpeg") || fileExtType.toString().includes("tiff")) {
                    //Use the mv() method to place the file in upload directory (i.e. "uploads")
                    myfile.mv('./uploads/' + myfile.name);

                    const path = __dirname + "/uploads/" + myfile.name; // pdf/jpeg/png/tiff formats

                    const readStream = fs.createReadStream(path);

                    const client = new FormRecognizerClient(endpoint, new AzureKeyCredential(apiKey));
                    const poller = await client.beginRecognizeContent(readStream);

                    const pages = await poller.pollUntilDone();

                    if (!pages || pages.length === 0) {
                        //throw new Error("Expecting non-empty list of pages!");
                        res.send({
                            status: "FAILED",
                            message: 'Encountered Error during form recognition',
                            data: {
                                formdata: "null"

                            }
                        });
                    }
                    else {

                        for (const page of pages) {
                            console.log(
                                `Page ${page.pageNumber}: width ${page.width} and height ${page.height} with unit ${page.unit}`
                            );
                            for (const table of page.tables) {
                                for (const cell of table.cells) {
                                    console.log(`cell [${cell.rowIndex},${cell.columnIndex}] has text ${cell.text}`);
                                }
                            }
                        }

                        //send response
                        res.status(200).send({
                            status: "SUCCESS",
                            message: 'Form is recognized',
                            data: {
                                formdata: pages

                            }
                        });
                    }
                } else {
                    res.status(400).send({
                        status: "FAILED",
                        message: 'Invalid File format. Allowed file types jpeg, png, tiff or pdf'
                    });
                }
            }
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

/**
 * @swagger
 * /FormRecognizerApi/v1/Form/ReadfromURL:
 *   post:
 *     summary: enter the URL of the form whose data needs to be scanned 
 *     tags:
 *       - Form
 *     description: reads a form using URL
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: URL String
 *         description: Enter the whole url string
 *         in: body
 *         required: true
 *         schema:
 *           $ref: '#/definitions/URL'
 *     responses:
 *       200:
 *         description: Form recognized from the URL
 *       400:
 *         description: Bad request or invalid URL entered
 *       500:
 *         description: Error during form recognition
 */
app.post('/FormRecognizerApi/v1/Form/ReadfromURL', async (req, res) => {
    try {
        console.log(req.body.URLstring);
        const urlpath = req.body.URLstring;

        if (!validUrl.isWebUri(urlpath)) {
            console.log("bad URL" + urlpath);
            res.status(400).send({
                status: "FAILED",
                message: 'Invalid URL',

            });
        }
        else {

            var tempURL = urlpath.split(".");
            const fileformat = tempURL[tempURL.length - 1];

            if (fileformat.toString().includes("pdf") || fileformat.toString().includes("png") ||
                fileformat.toString().includes("jpeg") || fileformat.toString().includes("tiff") || fileformat.toString().includes("jpg")
            ) {
                const client = new FormRecognizerClient(endpoint, new AzureKeyCredential(apiKey));
                const poller = await client.beginRecognizeContentFromUrl(urlpath);

                const pages = await poller.pollUntilDone();

                if (!pages || pages.length === 0) {
                    //throw new Error("Expecting non-empty list of pages!");
                    res.send({
                        status: "FAILED",
                        message: 'Encountered Error during form recognition',
                        data: {
                            formdata: "null"

                        }
                    });
                }
                else {
                    //send response
                    res.status(200).send({
                        status: "SUCCESS",
                        message: 'Form is recognized',
                        data: {
                            formdata: pages

                        }
                    });
                }
            } else {
                res.status(400).send({
                    status: "FAILED",
                    message: 'Invalid File format:--' + fileformat + '.  Allowed file types jpeg, png, tiff or pdf'
                });
            }
        }

    } catch (err) {
        res.status(500).send(err);
    }
});


/**
 * @swagger
 * /FormRecognizerApi/v1/Receipt/ReadReceiptfromFile:
 *   post:
 *     summary: Upload a image of the receipt in jpeg/png/tiff/pdf formats 
 *     tags:
 *       - Receipt
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: myReceipt
 *         type: file
 *         description: The receipt to upload. File size limit 10 MB.
 *     responses:
 *       200:
 *         description: Success            
 */
app.post('/FormRecognizerApi/v1/Receipt/ReadReceiptfromFile', async (req, res) => {
    try {
        if (!req.files) {
            res.send({
                status: "FAILED",
                message: 'No Receipt uploaded'
            });
        } else {
            //Use the name of the input field (i.e. "myfile") to retrieve the uploaded file
            let myReceipt = req.files.myReceipt;
            if (myReceipt.size > 10000000) {
                res.send({
                    status: "FAILED",
                    message: 'File Too Large. Greater than 10 MB'
                });

            }
            else {
                console.log("file type is ----" + myReceipt.mimetype);
                const fileExtType = myReceipt.mimetype;

                if (fileExtType.toString().includes("pdf") || fileExtType.toString().includes("png")
                    || fileExtType.toString().includes("jpeg") || fileExtType.toString().includes("tiff")) {
                    //Use the mv() method to place the file in upload directory (i.e. "uploads")
                    myReceipt.mv('./uploads/' + myReceipt.name);

                    const path = __dirname + "/uploads/" + myReceipt.name; // pdf/jpeg/png/tiff formats

                    const readStream = fs.createReadStream(path);

                    const client = new FormRecognizerClient(endpoint, new AzureKeyCredential(apiKey));
                    const poller = await client.beginRecognizeReceipts(readStream);

                    const receipts = await poller.pollUntilDone();

                    if (!receipts || receipts.length === 0) {
                        //throw new Error("Expecting non-empty list of pages!");
                        res.send({
                            status: "FAILED",
                            message: 'Encountered Error during receipt recognition',
                            data: {
                                formdata: "null"

                            }
                        });
                    }
                    else {
                        //send response
                        res.status(200).send({
                            status: "SUCCESS",
                            message: 'Receipt is recognized',
                            data: {
                                formdata: receipts

                            }
                        });
                    }
                } else {
                    res.status(400).send({
                        status: "FAILED",
                        message: 'Invalid File format. Allowed file types jpeg, png, tiff or pdf'
                    });
                }
            }
        }
    } catch (err) {
        res.status(500).send(err);
    }
});


/**
 * @swagger
 * /FormRecognizerApi/v1/Receipt/ReadReceiptfromURL:
 *   post:
 *     summary: enter the URL of the Receipt whose data needs to be scanned 
 *     tags:
 *       - Receipt
 *     description: reads a Receipt using URL
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: URL String
 *         description: Enter the whole url string
 *         in: body
 *         required: true
 *         schema:
 *           $ref: '#/definitions/URL'
 *     responses:
 *       200:
 *         description: Receipt recognized from the URL
 *       400:
 *         description: Bad request or invalid URL entered
 *       500:
 *         description: Error during Receipt recognition
 */
app.post('/FormRecognizerApi/v1/Receipt/ReadReceiptfromURL', async (req, res) => {
    try {
        console.log(req.body.URLstring);
        const urlpath = req.body.URLstring;

        if (!validUrl.isWebUri(urlpath)) {
            console.log("bad URL" + urlpath);
            res.status(400).send({
                status: "FAILED",
                message: 'Invalid URL',

            });
        }
        else {
            var tempURL = urlpath.split(".");
            const fileformat = tempURL[tempURL.length - 1];

            if (fileformat.toString().includes("pdf") || fileformat.toString().includes("png") ||
                fileformat.toString().includes("jpeg") || fileformat.toString().includes("tiff") || fileformat.toString().includes("jpg")
            ) {
                const client = new FormRecognizerClient(endpoint, new AzureKeyCredential(apiKey));
                const poller = await client.beginRecognizeReceiptsFromUrl(urlpath);

                const pages = await poller.pollUntilDone();

                if (!pages || pages.length === 0) {
                    //throw new Error("Expecting non-empty list of pages!");
                    res.send({
                        status: "FAILED",
                        message: 'Encountered Error during form recognition',
                        data: {
                            formdata: "null"

                        }
                    });
                }
                else {
                    //send response
                    res.status(200).send({
                        status: "SUCCESS",
                        message: 'Receipt is recognized',
                        data: {
                            formdata: pages

                        }
                    });
                }
            } else {
                res.status(400).send({
                    status: "FAILED",
                    message: 'Invalid File format:--' + fileformat + '.  Allowed file types jpeg, png, tiff or pdf'
                });
            }
        }

    } catch (err) {
        res.status(500).send(err);
    }
});


const specs2 = swaggerJsdoc2(options);
app.use('/FormRecognizerApi/docs', swaggerUI2.serve, swaggerUI2.setup(specs2));
