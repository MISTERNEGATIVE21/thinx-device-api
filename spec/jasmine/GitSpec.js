describe("Git", function() {

    var expect = require('chai').expect;
    let Git = require("../../lib/thinx/git");

    it("should be able to fetch", function(done) {
        let git = new Git();
        let success = git.fetch(
            "07cef9718edaad79b3974251bb5ef4aedca58703142e8c4c48c20f96cda4979c", // owner
            "git clone https://github.com/suculent/thinx-firmware-esp8266-pio", // command
            __dirname // local_path
        );
        expect(success).to.be(true); // will fail, until local_path is valid git repo or a temp folder with different command; should use http:// in empty folder outside a git structure like /mnt/data/repos/
        done();
    }, 10000);

    it("should survive invalid input", function() {
        let git = new Git();
        let success = git.tryShellOp("ls", "~");        
        expect(success).to.be(true);
    });

});