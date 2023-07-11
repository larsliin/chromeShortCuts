function urlValid(str) {
    var expression = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;
    var regex = new RegExp(expression);

    return !!str.match(regex);
}

function getDomainFromUrl(url) {
    const regex = /(?<=:\/\/)([^\/]+)/;
    const domain = url.match(regex);
    if (domain) {
        return domain[0];
    }
    return null;
}