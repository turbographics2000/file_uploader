const uploadFiles = [];
let uploading = false;

uploadListSwitchButton.onclick = function (evt) {
    this.textContent = this.textContent === '▲' ? '▼' : '▲';
    uploadList.classList.toggle('small');
};

document.ondragover = evt => evt.preventDefault();
document.ondrop = async evt => {
    evt.preventDefault();
    const files = [...evt.dataTransfer.files];
    if (files.length) {
        uploadList.classList.add('show');
        uploadListTab.classList.add('show');
    }
    files.forEach(file => {
        uploadFiles.push(file);
        createUploadItem(file);
    });
    uploadCount.textContent = uploadFiles.length;
    if (!uploading) {
        uploading = true;
        uploadList.classList.add('show');
        uploadListTab.classList.add('show');
        upload(uploadFiles[0]);
    }
}

function upload(file) {
    let uploadItem = document.getElementById(`upload_${file.uploadId}`);
    let cancelButton = document.getElementById(`uploadCancel_${file.uploadId}`);
    let size = document.getElementById(`uploadFileSize_${file.uploadId}`);
    let progressBar = document.getElementById(`uploadProgress_${file.uploadId}`);
    let xhr = new XMLHttpRequest();

    uploadItem.scrollIntoView();
    const next = _ => {
        uploadItem.remove();
        xhr = null;
        uploadItem = null;
        cancelButton = null;
        size = null;
        progressBar = null;
        const index = uploadFiles.findIndex(item => item.id === file.id);
        if (index !== -1) {
            uploadFiles.splice(index, 1);
        }
        uploadCount.textContent = uploadFiles.length;
        if (uploadFiles.length) {
            upload(uploadFiles[0]);
        } else {
            uploadList.classList.remove('show');
            uploadListTab.classList.remove('show');
            uploading = false;
        }
    }

    cancelButton.onclick = evt => {
        xhr.abort();
        next();
    }

    xhr.upload.onloadstart = evt => {
        size.textContent = `0B/${readableFileSize(evt.total)}`;
    };

    xhr.upload.onprogress = evt => {
        progressBar.style.width = `${(evt.loaded / evt.total) * 100 | 0}%`;
        size.textContent = `${readableFileSize(evt.loaded)}/${readableFileSize(evt.total)}`;
    };

    xhr.onload = evt => {
        createFileListItem(xhr.response[0]);
        next();
    };

    xhr.open('POST', `/fileup`);
    xhr.responseType = 'json';
    const fd = new FormData();
    fd.append('file', file, file.name);
    xhr.send(fd);
}

function createUploadItem(file) {
    file.uploadId = (new MediaStream()).id.replace(/{|}|-/g, '');
    const item = document.createElement('div');
    const name = document.createElement('div');
    const icon = document.createElement('div');
    const cancelButton = document.createElement('div');
    const size = document.createElement('div');
    const prgContainer = document.createElement('div');
    const progressBar = document.createElement('div');
    item.id = `upload_${file.uploadId}`;
    cancelButton.id = `uploadCancel_${file.uploadId}`;
    size.id = `uploadFileSize_${file.uploadId}`;
    progressBar.id = `uploadProgress_${file.uploadId}`;
    item.className = 'upload-item';
    icon.className = `upload-icon ${file.type.split('/')[0]}`;
    name.className = 'upload-filename';
    cancelButton.className = 'upload-cancel-button';
    size.className = 'upload-filesize';
    prgContainer.className = 'uprogress-container';
    progressBar.className = 'uprogress-bar';
    name.textContent = file.name;
    cancelButton.textContent = '✖';
    item.appendChild(icon);
    item.appendChild(name);
    item.appendChild(size);
    item.appendChild(cancelButton);
    item.appendChild(prgContainer);
    prgContainer.appendChild(progressBar);
    uploadList.appendChild(item);
    return;
}

function createFileListItem(file) {
    const type = file.type.split('/')[0];
    const tag = { text: 'iframe', image: 'img', audio: 'audio', video: 'video' }[type];
    const item = document.createElement('div');
    const media = document.createElement(tag);
    const nameWrapper = document.createElement('div');
    const name = document.createElement('span');
    const deleteButton = document.createElement('div');
    const downloadButton = document.createElement('a');
    item.id = `f${file.id}`;
    item.className = `item ${type}`;
    media.src = `/${file.id}`;
    if (['audio', 'video'].includes(type)) {
        media.controls = true;
        media.controlsList = 'nodownload';
    }
    nameWrapper.className = 'name';
    name.textContent = file.name;
    deleteButton.className = 'delete-button';
    deleteButton.textContent = '✖';
    deleteButton.dataset.id = file.id;
    downloadButton.className = 'download-button';
    downloadButton.href = `/${file.id}`;
    downloadButton.download = file.name;
    item.appendChild(media);
    item.appendChild(nameWrapper);
    item.appendChild(downloadButton);
    nameWrapper.appendChild(name);
    nameWrapper.appendChild(deleteButton);
    document.body.appendChild(item);
    setHandler();
}

function readableFileSize(size) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let s = size;
    let i = 0;
    while ((s /= 1024) | 0) i++;
    s *= 1024;
    let fd = `${(s | 0)}`.length;
    fd = fd === 1 ? 2 : fd === 2 ? 1 : 0;
    return `${s.toFixed(fd)}${units[i]}`;
}

function setHandler() {
    document.querySelectorAll('.delete-button').forEach(async btn => btn.onclick = async e => {
        const res = await fetch(`/filedel/${e.target.dataset.id}`);
        if (res.ok) {
            document.querySelector(`#f${e.target.dataset.id}`).remove();
        } else {
            console.log('err');
        }
    });
    document.querySelectorAll('.download-button').forEach(btn => btn.onclick = e => {
        const a = document.createElement('a');
        a.src = `/file/${e.target.dataset.id}`;
    });
}
setHandler();
