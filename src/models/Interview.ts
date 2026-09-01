import { ObjectId } from 'mongodb';

export interface Interview {
  _id?: ObjectId;
  studentId: string; // matches JWT uid of student
  employerId: string; // matches JWT uid of employer
  startTime: Date;
  endTime: Date;
  title?: string;
  meetingLink?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt?: Date;
}
