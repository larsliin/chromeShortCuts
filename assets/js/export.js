// export/import bookmarks
async function exportBookmarks() {
    const imgArr = await fetchLocalStorageBookmarks();

    const bookmarksCloned = structuredClone(bookmarks);

    imgArr.forEach(obj => {
        // Loop through the object's key-value pairs
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const foundObject = bookmarksCloned.find(obj => obj.children.find(child => child.id === key));
                const child = foundObject.children.find(e => e.id === key);

                if (foundObject && child) {
                    child.base64 = obj[key].image;
                }
            }
        }
    });

    const jsonString = JSON.stringify(bookmarksCloned);

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([jsonString], { type: "application/json" }));
    a.download = 'bookmarks-exported.json';
    a.click();
}

async function fetchLocalStorageBookmarks() {
    const ids = bookmarks.flatMap(data => data.children.map(child => child.id));
    const promises = [];

    for (const id of ids) {
        const promise = getLocalStorage(id);
        promises.push(promise.then(value => ({ [id]: value })));
    }

    const allPromises = await Promise.all(promises);

    // filter away objects with value = undefined
    const result = allPromises.filter(obj => {
        const values = Object.values(obj);
        return !values.some(value => value === undefined);
    });
    return result;
};


// export/import bookmark icon images
async function exportBookmarkIcons() {
    const imgArr = await fetchLocalStorageBookmarks();

    const jsonString = JSON.stringify(imgArr);

    const a = document.createElement('a');

    a.href = URL.createObjectURL(new Blob([jsonString], { type: "application/json" }));
    a.download = 'bookmark-icons-exported.json';
    a.click();
}

function importBookmarkIcons(event) {
    if (!event.target.files.length) {
        return;
    }
    const reader = new FileReader();
    reader.onload = onImportIconsReaderLoad;
    reader.readAsText(event.target.files[0]);
    inpReadonlyImportIcons.value = event.target.files[0].name;
}

function onImportIconsReaderLoad(event) {
    importIconsFile = JSON.parse(event.target.result);
}