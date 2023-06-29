const bookmarkData = [];
let imageArr;
let count = 0;
function exportBookmarks() {
    imageArr = bookmarks.flatMap(data => data.children.map(child => child.id));

    getImageData(count);
}

async function getImageData(index) {
    const response = await getLocalStorage(imageArr[index]);
    if (index < imageArr.length) {
        if (response) {
            bookmarkData.push({ [imageArr[index]]: response.image })
        }
        count = count + 1;
        getImageData(count);

    } else {
        console.log(bookmarkData);
    }
}