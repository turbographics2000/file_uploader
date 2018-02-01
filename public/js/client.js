const uploadFileQueue = [];
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
        // アップロードファイルリストを表示        
        uploadList.classList.add('show');
        uploadListTab.classList.add('show');
    }
    files.forEach(file => {
        // キューに登録
        uploadFileQueue.push(file);
        // アップロードファイルリスト(UI)にアイテムを追加
        createUploadItem(file);
    });
    // アップロード数表示の更新
    uploadCount.textContent = uploadFileQueue.length;
    // アップロード中でなければアップロードを開始する
    if (!uploading) {
        uploading = true;
        upload(uploadFileQueue[0]);
    }
}

function upload(file) {
    // アップロードファイルリストの対象アイテムで、アップロード処理で扱う各エレメントを取得
    let uploadItem = document.getElementById(`upload_${file.uploadId}`);
    let cancelButton = document.getElementById(`uploadCancel_${file.uploadId}`);
    let size = document.getElementById(`uploadFileSize_${file.uploadId}`);
    let progressBar = document.getElementById(`uploadProgress_${file.uploadId}`);

    // スクロールで表示領域外だった場合もあるため、表示領域内になるようスクロール
    uploadItem.scrollIntoView();

    let xhr = new XMLHttpRequest();

    // 次のジョブへ(使用する変数を渡すのが面倒なのでクロージャーで処理)
    const next = _ => {
        // アップロードファイルリストから対象アイテムを削除
        uploadItem.remove();
        xhr = null;
        uploadItem = null;
        cancelButton.onclick = null;
        cancelButton = null;
        size = null;
        progressBar = null;

        // キューから今回のジョブを削除
        const index = uploadFileQueue.findIndex(item => item.id === file.id);
        if (index !== -1) {
            uploadFileQueue.splice(index, 1);
        }
        
        // アップロード数表示の更新
        uploadCount.textContent = uploadFileQueue.length;
        
        if (uploadFileQueue.length) {
            // キューが存在すれば次のファイルのアップロードを行う
            upload(uploadFileQueue[0]);
        } else {
            // アップロードが完了したら、
            // アップロードファイルリストを非表示にし、
            // アップロード中フラグをクリア
            uploadList.classList.remove('show');
            uploadListTab.classList.remove('show');
            uploading = false;
        }
    }

    cancelButton.onclick = evt => {
        // アップロードキャンセル
        xhr.abort();
        next();
    }

    xhr.upload.onprogress = evt => {
        // アップロードの進捗更新(プログレスバーおよびアップロード済みのサイズ)
        progressBar.style.width = `${(evt.loaded / evt.total) * 100 | 0}%`;
        size.textContent = `${readableFileSize(evt.loaded)}/${readableFileSize(evt.total)}`;
    };

    xhr.onload = evt => {
        // 完了したら、レスポンスでGridFSに登録されたファイル情報が返ってくるので、
        // それをもとにファイルリストのアイテムを作成する
        createFileListItem(xhr.response[0]);
        next();
    };

    // ファイルをアップロード
    xhr.open('POST', `/fileup`);
    xhr.responseType = 'json';
    const fd = new FormData();
    fd.append('file', file, file.name);
    xhr.send(fd);
}

function createUploadItem(file) {
    // アップロードファイルリストに表示するアイテムを作成
    // jQuery等使用せず生のDOMメソッドでアイテムを作成
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
    // ファイルリストのアイテム作成
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
        // コントロールを表示(ただしダウンロードボタンは非表示にする)
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
    // ～MBといった読みやすいファイルサイズの文字列に変換
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
    // 削除ボタン、ダウンロードボタンのイベントハンドラー設定
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

// 初回ページアクセス時はSSRされるので、イベントハンドラー設定処理を実行
setHandler();
