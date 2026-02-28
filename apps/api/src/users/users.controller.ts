import {
  Controller, Get, Post, Patch, Param, Body, UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll() { return this.usersService.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.usersService.findOne(id); }

  @Post()
  create(@Body() dto: CreateUserDto) { return this.usersService.create(dto); }

  @Patch(':id/role')
  updateRole(@Param('id') id: string, @Body('roleId') roleId: string) {
    return this.usersService.updateRole(id, roleId);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) { return this.usersService.deactivate(id); }
}
