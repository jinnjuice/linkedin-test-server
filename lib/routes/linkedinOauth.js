Router.map(function () {
    this.route('linkedin_oauth', {
        path: 'uas/oauth2/authorization',
        template: 'login'
    });
    /**
     * "https://www.linkedin.com/uas/oauth2/accessToken?grant_type=authorization_code" +
     * "&code=" + code +
     * "&redirect_uri=%s" +
     * "&client_id=%s" +
     * "&client_secret=%s"
     */
    this.route('linkedin_oauth', {
        path: 'uas/oauth2/accessToken',
        where: 'server',
        action: function() {
            var grantType = this.request.body.grant_type;
            var code = this.request.body.code;
            var redirect_uri = this.request.body.redirect_uri;
            var client_id = this.request.body.client_id;
            var client_secret = this.request.body.client_secret;
            if ( grantType !== 'authorization_code') {
                throw new Meteor.Error(400);
            }
            var authentication = AuthenticationManager.findOne({'linkedInResponseSignOn.code':code});
            if ( authentication == null) {
                throw new Meteor.Error(400, 'missing authentication');
            }
            var response;
            var statusCode = authentication.linkedInResponseAccessToken.statusCode || 200;
            if ( authentication.linkedInResponseAccessToken.timesFail > 0) {
                response = {
                    error: authentication.linkedInResponseAccessToken.error,
                    error_description: authentication.linkedInResponseAccessToken.error_description,
                }
                authentication.linkedInResponseAccessToken.timesFail--;
                authentication._save();
            } else {
                response = {
                    access_token: authentication.linkedInResponseAccessToken.access_token,
                    expires_in: 1111111111,
                };
                statusCode = 200;
            }
            this.response.writeHeader(statusCode, {"Content-Type": "application/json;charset=UTF-8"});
            this.response.write(EJSON.stringify(response));
        }
    });

    this.route('linkedin_identity', {
        path: 'v1/people/:filepath',
        where: 'server',
        action: function() {
            var format = this.request.query.format;
            if ( format != 'json') {
                throw new Meteor.Error(400, 'Must have format as json');
            }
            var oauth2_access_token = this.request.query.oauth2_access_token;
            var authentication = AuthenticationManager.findOne({'linkedInResponseAccessToken.access_token': oauth2_access_token});
            if ( authentication == null) {
                throw new Meteor.Error(400, 'missing authentication');
            }
            var fields = this.params.filepath;
            if (fields.length > 3) {
                fields = fields.substring(3, fields.length-1).split(',');
                for (var i in fields) {
                    var pos = fields[i].indexOf(';');
                    if (pos > -1) {
                        //Remove ;secured=true field parameters.
                        fields[i] = fields[i].substring(0, pos);
                    }
                    //Convert dash notation to camelCase.
                    fields[i] = fields[i].replace(/-([a-z])/g, function (g) { return g[1].toUpperCase(); })
                }
            } else {
                //No fields specified. Fall back to default response.
                fields = ['firstName', 'headline', 'lastName', 'id'];
            }
            var profile = _.pick(authentication.profile, fields);
            var response = _.extend(profile, {
                siteStandardProfileRequest: {
                    url: 'http://localhost:7000?id=' + authentication.profile.id + '&' + authentication.state
                }
            });

            this.response.writeHeader(authentication.linkedInResponseAccessToken.statusCode || 200, {"Content-Type": "application/json;charset=UTF-8"});
            this.response.write(EJSON.stringify(response));
        }
    });


});
