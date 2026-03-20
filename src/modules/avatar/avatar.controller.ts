import { Controller, Get, Post, UseInterceptors, UploadedFile, Param, Delete } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AvatarService } from './avatar.service';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}

@Controller('avatar')
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(@UploadedFile() file: MulterFile) {
    return this.avatarService.uploadAvatar(file);
  }

  @Get(':userId')
  getAvatar(@Param('userId') userId: string) {
    return this.avatarService.getAvatar(userId);
  }

  @Delete(':userId')
  deleteAvatar(@Param('userId') userId: string) {
    return this.avatarService.deleteAvatar(userId);
  }
}
