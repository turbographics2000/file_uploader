const fs = require('fs');
const path = require('path');
const Koa = require('koa');
const serve = require('koa-static');
const Router = require('koa-router');
const mongoose = require('mongoose');
const asyncBusboy = require('async-busboy');

const MONGODB_URI = 'mongodb://user:password@localhost:27017/test';
let gridfs = null;
let mongoFile = null;
mongoose.connect(MONGODB_URI).then(_ => {
    gridfs = require('mongoose-gridfs')({
        collection: 'myFS',
        model: 'Files',
        mongooseConnection: mongoose.connection
    });
    mongoFile = gridfs.model;
});

const app = new Koa();
const router = new Router();
const gridSchema = new mongoose.Schema({
    filename: String,
    contentType: String,
    length: Number,
    chunkSize: Number,
    uploadDate: Date,
    aliases: Object,
    metadata: Object,
    md5: String
});
const Grid = mongoose.model('Grid', gridSchema, 'myFS.files');

router.get('/', async ctx => {
    await Grid.find({}, async (err, gridFiles) => {
        if (err) {
            ctx.throw(500);
            return;
        }
        let body = fs.readFileSync('views/filetest.html', 'utf8');
        ctx.type = 'html';
        ctx.body = body.replace('{list}', gridFiles.map(file => {
            const type = file.contentType.split('/')[0];
            const tag = { text: 'iframe', image: 'img', audio: 'audio', video: 'video' }[type];
            const attr = ['audio', 'video'].includes(type) ? 'controls controlsList="nodownload"' : '';
            const name = file.filename;
            // なんちゃってSSR
            return `
<div id="f${file.id}" class="item ${type}">
    <${tag} src="/${file.id}" ${attr}></${tag}>
    <div class="name"><span>${name}</span><div class="delete-button" data-id="${file.id}">✖</div></div>
    <a class="download-button" href="/${file.id}" download="${name}"></a>
</div>`;
        }).join('\n'));
    });
});

router.get('/:id', async ctx => {
    const fileId = ctx.params.id;
    const meta = await Grid.findOne({ _id: fileId });
    if (!meta) {
        console.warn('meta is null', fileId);
        return;
    }
    const range = ctx.header.range;
    if (range) {
        let [start, end] = range.replace(/bytes=/, '').split('-');
        start = parseInt(start, 10);
        end = end ? parseInt(end, 10) : meta.length - 1;
        const chunkSize = (end - start) + 1;
        ctx.set('Accept-Ranges', `bytes`);
        ctx.set('Content-Range', `bytes ${start}-${end}/${meta.length}`);
        ctx.set('Content-Length', chunkSize);
        ctx.status = 206;
        const stream = gridfs.storage.createReadStream({
            _id: fileId,
            root: 'myFS',
            range: {
                startPos: start,
                endPos: end
            }
        });
        ctx.type = meta.contentType;
        ctx.body = stream;
    } else {
        const stream = gridfs.storage.createReadStream({
            _id: fileId,
            root: 'myFS'
        });
        ctx.type = meta.contentType;
        ctx.body = stream;
    }
});

router.post('/fileup', async ctx => {
    try {
        const { files, fields } = await asyncBusboy(ctx.req);
        const res = [];
        await Promise.all(files.map(async file => {
            await (_ => {
                return new Promise((resolve, reject) => {
                    gridfs.write(
                        {
                            filename: file.filename,
                            contentType: file.mimeType
                        },
                        file,
                        (err, createdFile) => {
                            if (err) {
                                reject(err);
                            } else {
                                res.push({
                                    id: createdFile._id.toString(), // file._idはObjectId型
                                    type: createdFile.contentType,
                                    name: createdFile.filename
                                });
                                resolve();
                            }
                        }
                    );
                });
            })();
        }));
        ctx.body = JSON.stringify(res);
    } catch (err) {
        ctx.throw(500);
    }
});

router.get('/filedel/:id', async ctx => {
    await (_ => {
        return new Promise(resolve => {
            mongoFile.unlinkById(ctx.params.id, (err, unlinkedFile) => {
                if (err) {
                    ctx.throw(500);
                } else {
                    ctx.body = ctx.params.id;
                }
                resolve();
            });
        });
    })();
});

app.use(serve(__dirname + '/public'));
app.use(router.routes());
app.use(router.allowedMethods());

const port = process.env.PORT || 3000;
app.listen(port, _ => console.log('Server listening on', port));
