# Generate letsencrypt certificat using certbot

1. Install certbot  
```bash
$ sudo apt-get update
$ sudo apt-get install software-properties-common
$ sudo add-apt-repository ppa:certbot/certbot
$ sudo apt-get update
$ sudo apt-get install certbot
```

2. Generate nitial certificate
```bash
 sudo certbot certonly --standalone -d example.com -d www.example.com
```

3. Renew your certificate
```bash
 sudo certbot renew --dry-run  add it to cron
```
