# run with sudo for docker-compose
if [ ! -f $HOME/docker-compose-`uname -s`-`uname -m` ]; then
    echo "Download docker-compose..."
    # Download latest version
    curl -L https://github.com/docker/compose/releases/download/$(curl -s -L https://github.com/docker/compose/releases/latest | \
        grep -Eo -m 1 docker/compose/releases/tag/\([0-9.]*\) | \
        grep -o [0-9.]*)/docker-compose-`uname -s`-`uname -m` \
    > $HOME/docker-compose-`uname -s`-`uname -m`
    # Download fixed version
    # curl -L https://github.com/docker/compose/releases/download/1.3.1/docker-compose-`uname -s`-`uname -m` \
    # > $HOME/docker-compose-`uname -s`-`uname -m`
    echo "Done!"
fi
echo "Install docker-compose on path..."
cp $HOME/docker-compose-`uname -s`-`uname -m` /usr/local/bin/docker-compose &&
chmod +x /usr/local/bin/docker-compose
echo "Done!"

