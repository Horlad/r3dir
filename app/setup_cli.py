from setuptools import setup, find_packages

setup(
        name ='r3dir',
        version ='0.2.0',
        author ='Horlad',
        url ='https://github.com/Horlad/r3dir',
        description ='r3dir CLI encoder/decoder',
        license ='Apache License 2.0',
        entry_points ={
            'console_scripts': [
                'r3dir = coder.redirect_encoder:main'
            ]
        },
        zip_safe = False
)