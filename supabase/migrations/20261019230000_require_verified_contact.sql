-- Every approved club account must verify a personal email address or
-- link a Google/Apple identity before accessing club data.
update club_security.configuration
set verified_contact_required = true,
    updated_at = now()
where singleton;
